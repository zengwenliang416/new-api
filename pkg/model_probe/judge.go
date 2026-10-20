package model_probe

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"math/big"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/model"
)

var terminalNumber = regexp.MustCompile(`(?:^|[^0-9,.+eE/−'-])([+-]?[0-9]+(?:\.[0-9]+)?)$`)
var boxedNumber = regexp.MustCompile(`\\boxed\{([+-]?[0-9]+(?:\.[0-9]+)?)\}$`)
var localID = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_.-]*$`)
var localPaint = regexp.MustCompile(`^url\(\s*['"]?#[A-Za-z_][A-Za-z0-9_.-]*['"]?\s*\)$`)

func judgeMath(output, expected string) (string, string) {
	text := strings.TrimSpace(output)
	// Delimiters may wrap a final answer, but trailing prose and arbitrary last
	// digits do not qualify. In particular, 1/21 and 2e21 must not become 21.
	text = strings.TrimRight(text, " \r\n\t。.!！*`_$\\()[]")
	if match := boxedNumber.FindStringSubmatch(text); match != nil {
		text = match[1]
	}
	match := terminalNumber.FindStringSubmatch(text)
	if match == nil || len(match[1]) > 128 {
		return model.ModelProbeStatusFail, ""
	}
	answer := match[1]
	if strings.HasSuffix(strings.TrimSpace(strings.TrimSuffix(text, answer)), "/") {
		return model.ModelProbeStatusFail, ""
	}
	actual, ok := new(big.Rat).SetString(answer)
	want, valid := new(big.Rat).SetString(strings.TrimSpace(expected))
	if ok && valid && actual.Cmp(want) == 0 {
		return model.ModelProbeStatusPass, answer
	}
	return model.ModelProbeStatusFail, answer
}

var svgElements = map[string]bool{
	"svg": true, "g": true, "defs": true, "path": true, "rect": true, "circle": true,
	"ellipse": true, "line": true, "polyline": true, "polygon": true, "text": true,
	"tspan": true, "title": true, "desc": true, "linearGradient": true, "radialGradient": true,
	"stop": true, "clipPath": true, "mask": true, "pattern": true, "symbol": true,
	"use": true, "animate": true, "animateTransform": true, "animateMotion": true, "mpath": true,
}
var svgAttributes = map[string]bool{
	"id": true, "viewBox": true, "width": true, "height": true, "preserveAspectRatio": true,
	"x": true, "y": true, "x1": true, "x2": true, "y1": true, "y2": true,
	"cx": true, "cy": true, "r": true, "rx": true, "ry": true, "d": true, "points": true,
	"fill": true, "fill-opacity": true, "fill-rule": true, "stroke": true, "stroke-width": true,
	"stroke-opacity": true, "stroke-linecap": true, "stroke-linejoin": true, "stroke-dasharray": true,
	"stroke-dashoffset": true, "opacity": true, "transform": true, "clip-path": true,
	"clip-rule": true, "mask": true, "offset": true, "stop-color": true, "stop-opacity": true,
	"gradientUnits": true, "gradientTransform": true, "spreadMethod": true,
	"patternUnits": true, "patternContentUnits": true, "patternTransform": true,
	"markerWidth": true, "markerHeight": true, "text-anchor": true, "dominant-baseline": true,
	"font-size": true, "font-family": true, "font-weight": true, "dx": true, "dy": true,
	"href": true, "attributeName": true, "type": true, "from": true, "to": true,
	"by": true, "values": true, "keyTimes": true, "keySplines": true, "calcMode": true,
	"dur": true, "begin": true, "end": true, "repeatCount": true, "repeatDur": true,
	"additive": true, "accumulate": true, "path": true, "rotate": true,
}
var animationAttributes = map[string]bool{
	"x": true, "y": true, "x1": true, "x2": true, "y1": true, "y2": true,
	"cx": true, "cy": true, "r": true, "rx": true, "ry": true, "width": true, "height": true,
	"d": true, "points": true, "opacity": true, "fill": true, "fill-opacity": true,
	"stroke": true, "stroke-width": true, "stroke-opacity": true, "stroke-dashoffset": true,
	"transform": true,
}

var errDrawingTooLarge = errors.New("drawing exceeds its size limit")

// sanitizeDrawing extracts one SVG and reconstructs an allowlisted document.
// Scripts, event attributes, foreignObject, external resources and CSS are not
// copied. SMIL can animate only safe presentation/geometry attributes. The
// surrounding untrusted HTML is never rendered.
func sanitizeDrawing(output string) (string, error) {
	if len(output) > maxResponseBytes {
		return "", errDrawingTooLarge
	}
	start := strings.Index(output, "<svg")
	if start < 0 {
		return "", fmt.Errorf("no SVG document")
	}
	decoder := xml.NewDecoder(strings.NewReader(output[start:]))
	var out bytes.Buffer
	encoder := xml.NewEncoder(&out)
	depth, skipped, nodes, visible := 0, 0, 0, 0
parseSVG:
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("invalid SVG XML")
		}
		switch token := token.(type) {
		case xml.StartElement:
			depth++
			nodes++
			if depth > 64 || nodes > 10000 {
				return "", fmt.Errorf("SVG is too complex")
			}
			if skipped > 0 {
				skipped++
				continue
			}
			if !svgElements[token.Name.Local] || (token.Name.Space != "" && token.Name.Space != "http://www.w3.org/2000/svg") {
				skipped = 1
				continue
			}
			name := token.Name.Local
			if name == "animate" || name == "animateTransform" {
				valid := false
				for _, attribute := range token.Attr {
					if attribute.Name.Local == "attributeName" && animationAttributes[attribute.Value] {
						valid = true
					}
				}
				if !valid {
					skipped = 1
					continue
				}
			}
			clean := xml.StartElement{Name: xml.Name{Local: name}}
			if depth == 1 {
				clean.Attr = append(clean.Attr, xml.Attr{Name: xml.Name{Local: "xmlns"}, Value: "http://www.w3.org/2000/svg"})
			}
			for _, attribute := range token.Attr {
				key, value := attribute.Name.Local, strings.TrimSpace(attribute.Value)
				if !svgAttributes[key] || len(value) > 8000 {
					continue
				}
				if attribute.Name.Space != "" && !(key == "href" && attribute.Name.Space == "http://www.w3.org/1999/xlink") {
					continue
				}
				if key == "href" {
					if !strings.HasPrefix(value, "#") || !localID.MatchString(strings.TrimPrefix(value, "#")) {
						continue
					}
				} else if key == "id" {
					if !localID.MatchString(value) {
						continue
					}
				} else if strings.Contains(strings.ToLower(value), "url(") {
					if !localPaint.MatchString(value) {
						continue
					}
				} else if strings.ContainsAny(value, "\\:@/<>&\x00\r\n") {
					continue
				}
				clean.Attr = append(clean.Attr, xml.Attr{Name: xml.Name{Local: key}, Value: value})
			}
			if err := encoder.EncodeToken(clean); err != nil {
				return "", err
			}
			if name == "path" || name == "rect" || name == "circle" || name == "ellipse" || name == "line" || name == "polyline" || name == "polygon" || name == "text" || name == "use" {
				visible++
			}
		case xml.EndElement:
			depth--
			if skipped > 0 {
				skipped--
				continue
			}
			if err := encoder.EncodeToken(xml.EndElement{Name: xml.Name{Local: token.Name.Local}}); err != nil {
				return "", err
			}
			if depth == 0 {
				break parseSVG
			}
		case xml.CharData:
			if skipped == 0 {
				if err := encoder.EncodeToken(token); err != nil {
					return "", err
				}
			}
		case xml.Directive, xml.ProcInst:
			return "", fmt.Errorf("SVG directives are not supported")
		}
	}
	if depth != 0 || visible == 0 {
		return "", fmt.Errorf("SVG has no drawable content")
	}
	if err := encoder.Flush(); err != nil {
		return "", err
	}
	artifact := `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style></head><body>` + out.String() + `</body></html>`
	if len(artifact) > maxResponseBytes {
		return "", errDrawingTooLarge
	}
	return artifact, nil
}
