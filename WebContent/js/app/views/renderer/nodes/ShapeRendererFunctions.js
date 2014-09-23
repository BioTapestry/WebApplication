/*
 **    Copyright (C) 2003-2014 Institute for Systems Biology
 **                            Seattle, Washington, USA.
 **
 **    This library is free software; you can redistribute it and/or
 **    modify it under the terms of the GNU Lesser General Public
 **    License as published by the Free Software Foundation; either
 **    version 2.1 of the License, or (at your option) any later version.
 **
 **    This library is distributed in the hope that it will be useful,
 **    but WITHOUT ANY WARRANTY; without even the implied warranty of
 **    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 **    Lesser General Public License for more details.
 **
 **    You should have received a copy of the GNU Lesser General Public
 **    License along with this library; if not, write to the Free Software
 **    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
*/

define([
    "../renderer/DashedLineSupportDetector",
    "../fonts/FontUtils"
], function (
    DashedLineSupportDetector,
    FontUtils
) {
    var _make_rgb = function(array) {
        return "rgb(" + array[0] + "," + array[1] + "," + array[2] + ")";
    };

    var _make_rgba = function(array) {
        return "rgba(" + array[0] + "," + array[1] + "," + array[2] + "," + array[3] + ")";

    };

    var _set_dashed_line_with_browser_support = function(ctx, dash) {
        ctx.setLineDash(dash);
    };

    var _set_dashed_line_style_for_context =  DashedLineSupportDetector.getSupportLevel() == DashedLineSupportDetector.EMULATED ?
        function(ctx, dash) {} : _set_dashed_line_with_browser_support;

    var _make_font_descriptor = function(font) {
        var font_desc = "";

        // TODO input validation
        // Java.awt.Font family is of the form "Serif.bold" etc
        if (font.fontname.split('.')[1] == 'bold') {
            font_desc = "bold ";
        }

        return (font_desc + font.size * (4.0 / 5.0)) + "pt " + font.name;
    };

    var _degrees_to_radians = function(deg) {
        return deg * Math.PI / 180.0;
    };

    var _decode_and_set_stroke = function(ctx, stroke) {
        var strokeWidth = stroke[0],
            lineJoin = stroke[1],
            endCap = stroke[2];

        ctx.lineWidth = strokeWidth;

        // Decode line end cap style
        // -------------------------

        // CAP_BUTT
        if (endCap == 0) {
            ctx.lineCap = 'butt';
        }
        // CAP_ROUND
        else if (endCap == 1) {
            ctx.lineCap = 'round';
        }
        // CAP_SQUARE
        else if (endCap == 2) {
            ctx.lineCap = 'square';
        }

        // Decode line join style
        // ----------------------

        // JOIN_MITER
        if (lineJoin == 0) {
            ctx.lineJoin = 'miter';
        }
        // JOIN_ROUND
        else if (lineJoin == 1) {
            ctx.lineJoin = 'round';
        }
        // JOIN_BEVEL
        else if (lineJoin == 2) {
            ctx.lineJoin = 'bevel';
        }
    };

    return {
        // General utilities
        // -----------------
        makeRGB: _make_rgb,
        makeRGBA: _make_rgba,

        //_makeFontDescriptor: _make_font_descriptor,

        // Geometry utilities
        // ------------------
        //_degreesToRadians: _degrees_to_radians,

        // Canvas context state related
        // ----------------------------
        //_decodeAndSetStroke: _decode_and_set_stroke,

        _decodeAndPushTransform: function(ctx, trans) {
            var mtx = trans.matrix;

            ctx.save();
            ctx.transform(mtx[0], mtx[1], mtx[2], mtx[3], mtx[4], mtx[5]);
        },

        _decodeAndPushRotation: function(ctx, trans) {
            var thetaRadians = _degrees_to_radians(trans.t),
                x = trans.x,
                y = trans.y;

            // Translate to origin
            ctx.save();
            ctx.translate(x, y);

            // Rotate
            ctx.rotate(thetaRadians);

            ctx.translate(-x, -y);
        },

        _popTransform: function(ctx) {
            ctx.restore();
        },

        _drawArc: function(ctx, shape) {
            var cx = shape.cx,
                cy = shape.cy,
                r = shape.r,
                type = shape.draw_type,
                startAngleDeg = shape.start,
                extentDeg = shape.extent,
                startAngleRad = _degrees_to_radians(startAngleDeg),
                extentRad = _degrees_to_radians(extentDeg);


            // TODO Explanation here

            if (startAngleRad <= Math.PI) {
                startAngleRad = 2.0 * Math.PI - startAngleRad;
            }
            else {
                startAngleRad = startAngleRad - Math.PI;
            }

            var endRad = startAngleRad + extentRad,
                antiClockwise = true;

            _decode_and_set_stroke(ctx, shape.stroke);

            if (type == 'CHORD') {
                ctx.beginPath();
                ctx.arc(cx, cy, r, startAngleRad, endRad, antiClockwise);
                ctx.closePath();

                if (shape.mode == 'FILL') {
                    ctx.fillStyle = _make_rgba(shape.color);
                    ctx.fill();
                }
                else if (shape.mode == 'DRAW') {
                    ctx.strokeStyle = _make_rgba(shape.color);
                    ctx.stroke();
                }
            }
            else if (type == 'OPEN') {
                ctx.beginPath();
                ctx.arc(cx, cy, r, startAngleRad, endRad, antiClockwise);

                if (shape.mode == 'FILL') {
                    ctx.fillStyle = _make_rgba(shape.color);
                    ctx.fill();
                }
                else if (shape.mode == 'DRAW') {
                    ctx.strokeStyle = _make_rgba(shape.color);
                    ctx.stroke();
                }
            }
            else if (type == 'PIE') {
                // TODO implement pie arc rendering
            }
        },

        _drawEllipse: function(ctx, shape) {
            var cx = shape.cx,
                cy = shape.cy,
                r = shape.r;

            ctx.beginPath();
            ctx.arc(cx, cy, r, 2 * Math.PI, false);
            ctx.closePath();

            if (shape.mode == 'FILL') {
                ctx.lineWidth = shape.stroke[0];
                ctx.fillStyle = _make_rgba(shape.color);
                ctx.fill();
            }
            else if (shape.mode == 'DRAW') {
                ctx.lineWidth = shape.stroke[0];
                ctx.strokeStyle = _make_rgba(shape.color);
                ctx.stroke();
            }
        },

        _drawLine: function(ctx, shape) {
            var x1 = shape.x1,
                y1 = shape.y1,
                x2 = shape.x2,
                y2 = shape.y2;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);

            ctx.lineWidth = shape.stroke[0];
            ctx.strokeStyle = _make_rgba(shape.color);
            ctx.stroke();
        },

        _drawRectangle: function(ctx, shape) {
            ctx.beginPath();
            ctx.rect(shape.x, shape.y, shape.w, shape.h);
            ctx.closePath();

            if (shape.mode == 'FILL') {
                ctx.lineWidth = 0;
                ctx.fillStyle = _make_rgba(shape.color);
                ctx.fill();
            }
            else if (shape.mode == 'DRAW') {
                ctx.lineWidth = shape.stroke[0];
                ctx.strokeStyle = _make_rgba(shape.color);
                ctx.stroke();
            }
        },

        _drawSegmentedPathShape: function(ctx, shape) {
            var mode = shape.mode;

            _decode_and_set_stroke(ctx, shape.stroke);

            // TODO
            // does not work on all browsers
            if (shape.style !== null) {
                _set_dashed_line_style_for_context(ctx, shape.style);
            }

            ctx.beginPath();
            _.each(shape.segments, function(s) {
                var type = s.type,
                    points = s.points;

                if (type == 'MOVETO') {
                    ctx.moveTo(points[0], points[1]);
                }
                else if (type == 'LINETO') {
                    ctx.lineTo(points[0], points[1]);
                }
                else if (type == 'CLOSE') {
                    ctx.closePath();
                }
            });

            _decode_and_set_stroke(ctx, shape.stroke);

            if (mode == 'FILL') {
                ctx.fillStyle = _make_rgba(shape.color);
                ctx.fill();
            }
            else if (mode == 'DRAW') {
                ctx.strokeStyle = _make_rgba(shape.color);
                ctx.stroke();
            }

            _set_dashed_line_style_for_context(ctx, []);
        },

        _drawTextShape: function(ctx, shape) {
            ctx.save();
            ctx.translate(shape.x, shape.y);
            ctx.scale(shape.font.horizontal_scale, 1.0);

            ctx.font = FontUtils.makeFontDescriptor(shape.font);
            ctx.fillStyle = _make_rgba(shape.color);
            ctx.fillText(shape.text, 0, 0);

            ctx.restore();
        },

        _drawTextShapeWithFont: function(ctx, shape, font) {
            var canvas_font_property = FontUtils.makeFontDescriptor(font);
            ctx.save();
            ctx.translate(shape.x, shape.y);
            ctx.scale(font.horizontal_scale, 1.0);
            ctx.font = canvas_font_property;
            ctx.fillStyle = _make_rgba(shape.color);
            ctx.fillText(shape.text, 0, 0);

            ctx.restore();
        },

        _drawMultiLineFragment: function(ctx, fragment, color, font_descriptor) {
            ctx.font = font_descriptor;
            ctx.fillStyle = _make_rgba(color);
            ctx.fillText(fragment.text, 0, 0);
        }
    };

// end define
});
