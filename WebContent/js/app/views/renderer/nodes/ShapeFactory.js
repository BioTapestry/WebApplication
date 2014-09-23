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
    "../fonts/BioTapestryDefaultFonts",
    "../fonts/FontUtils",
    "./ShapeRendererFunctions",
    "../util/ClientPlatformSupport"

], function (
    DefaultFonts,
    FontUtils,
    ShapeRendererFunctions,
    ClientPlatformSupport

) {
    var ArcPrototype = {
        getType: function() {
            return "arc";
        },

        render: function(rendering_context, current_node) {
            var ctx = rendering_context.getCanvasContext();
            ShapeRendererFunctions._drawArc(ctx, this);
        }
    };

    var EllipsePrototype = {
        getType: function() {
            return "ellipse";
        },

        render: function(rendering_context, current_node) {
            var ctx = rendering_context.getCanvasContext();
            ShapeRendererFunctions._drawEllipse(ctx, this);
        }
    };

    var LinePrototype = {
        getType: function() {
            return "line";
        },

        render: function(rendering_context, current_node) {
            var ctx = rendering_context.getCanvasContext();
            ShapeRendererFunctions._drawLine(ctx, this);
        }
    };

    var RectPrototype = {
        getType: function() {
            return "rect";
        },

        render: function(rendering_context, current_node) {
            var ctx = rendering_context.getCanvasContext();
            ShapeRendererFunctions._drawRectangle(ctx, this);
        }
    };

    var PathPrototype = {
        getType: function() {
            return "path";
        },

        render: function(rendering_context, current_node) {
            var ctx = rendering_context.getCanvasContext();

            ShapeRendererFunctions._drawSegmentedPathShape(ctx, this);
        }
    };

    var MultiLineTextPrototype = {
        getType: function() {
            return "mltext";
        },

        render: function(rendering_context, current_node) {
            var ctx = rendering_context.getCanvasContext(),
                color = this.color,
                font_descriptor = FontUtils.makeFontDescriptor(this.font);

            _.each(this.fragments, function(fragment) {
                ctx.save();
                ctx.translate(fragment.x, fragment.y);
                ctx.scale(this.font.horizontal_scale, 1.0);

                ShapeRendererFunctions._drawMultiLineFragment(ctx, fragment, color, font_descriptor);

                ctx.restore();
            }, this);
        }
    };

    var TextPrototype = {
        getType: function() {
            return "text";
        },

        render: function(rendering_context, current_node) {
            var ctx = rendering_context.getCanvasContext();
            var font = this.font;
            ShapeRendererFunctions._drawTextShapeWithFont(ctx, this, font);
        }
    };

    var PushTransformPrototype = {
        getType: function() {
            return "push_transform";
        },

        render: function(rendering_context, current_node) {
            var ctx = rendering_context.getCanvasContext();
            ShapeRendererFunctions._decodeAndPushTransform(ctx, this);
        }
    };

    var PushRotOrigPrototype = {
        getType: function() {
            return "push_rot_orig";
        },

        render: function(rendering_context, current_node) {
            var ctx = rendering_context.getCanvasContext();
            ShapeRendererFunctions._decodeAndPushRotation(ctx, this);
        }
    };

    var PopTransformPrototype = {
        getType: function() {
            return "pop_transform";
        },

        render: function(rendering_context, current_node) {
            var ctx = rendering_context.getCanvasContext();
            ShapeRendererFunctions._popTransform(ctx);
        }
    };


    var NotImplementedShapePrototype = {
        getType: function() {
            return "none";
        },

        render: function(rendering_context, current_node) {
            var ctx = rendering_context.getCanvasContext();
        }
    };

    var builldInitialValuesWithLayer = function(shape_json, shape_field_names, extrafields) {
        var shape_layer_properties = {
            major: {
                value: shape_json.layer[0],
                enumerable: true
            },
            minor: {
                value: shape_json.layer[1],
                enumerable: true
            }
        };

        var initial_values = _.reduce(shape_field_names, function(values, field_name) {
            values[field_name] = {
                value: shape_json[field_name],
                enumerable: true
            };

            return values;
        }, { });

        var extra_field_values = {};

        if (extrafields !== undefined && _.isObject(extrafields)) {
            _.each(_.keys(extrafields), function(field_key) {
                extra_field_values[field_key] =  {
                    value: extrafields[field_key],
                    enumerable: true
                };
            });

        }

        return _.extend(shape_layer_properties, initial_values, extra_field_values);
    };

    var builldInitialValues = function(shape_json, shape_field_names, extrafields) {
        var initial_values = _.reduce(shape_field_names, function(values, field_name) {
            values[field_name] = {
                value: shape_json[field_name],
                enumerable: true
            };

            return values;
        }, { });

        var extra_field_values = {};

        if (extrafields !== undefined && _.isObject(extrafields)) {
            _.each(_.keys(extrafields), function(field_key) {
                extra_field_values[field_key] =  {
                    value: extrafields[field_key],
                    enumerable: true
                };
            });

        }

        return _.extend(initial_values, extra_field_values);
    };

    var FONT_ADJUST = {
        "win": {
            point_size: -10,
            limit_width: -0
        },
        "osx": {
            point_size: -7,
            limit_width: -0
        },
        "x11": {
            point_size: -10,
            limit_width: -0
        },
        "linux": {
            point_size: -10,
            limit_width: -0
        }
    };

    var scale_text = function(canvas_context, font_property, text, width_limit) {
        canvas_context.font = font_property;
        var metrics = canvas_context.measureText(text);
        var width = metrics.width;
        var horizontal_scaling_factor = 1.0;

        // If the client text token is too wide, make it more narrow by horizontal scaling
        if (width > width_limit) {
            horizontal_scaling_factor = width_limit / width;
        }
        // If the client text token is too narrow, center it within the limits
        else {
            // TODO fix text centering
        }

        return horizontal_scaling_factor;
    };

    var typemap = {
        "arc": {
            "type_label": "arc",
            "prototype_object": ArcPrototype,
            "field_names": ["color", "stroke", "mode", "cx", "cy", "r", "draw_type", "start", "extent"]
        },
        "ellipse": {
            "type_label": "ellipse",
            "prototype_object": EllipsePrototype,
            "field_names": ["color", "stroke", "mode", "cx", "cy", "r"]
        },
        "line": {
            "type_label": "line",
            "prototype_object": LinePrototype,
            "field_names": ["color", "stroke", "x1", "y1", "x2", "y2"]
        },
        "rect": {
            "type_label": "rect",
            "prototype_object": RectPrototype,
            "field_names": ["color", "stroke", "mode", "x", "y", "w", "h"]
        },
        "path": {
            "type_label": "path",
            "parsefunc": function(shape_json, current_node, rendering_context, model_fonts) {
                var fields = ["color", "stroke", "segments", "mode"];
                var stylevalue = null;

                if (_.has(shape_json, "style")) {
                    stylevalue = shape_json["style"];
                }

                var initial_values = builldInitialValuesWithLayer(shape_json, fields, {
                    "style": stylevalue
                });

                return Object.create(PathPrototype, initial_values);
            }
        },
        "mltext": {
            "type_label": "mltext",
            "parsefunc": function(shape_json, current_node, rendering_context, model_fonts) {
                var hasfont =  _.has(shape_json, 'font');
                var fields = ['color'];
                var font;
                var ctx = rendering_context.getCanvasContext();

                if (hasfont) {
                    font = shape_json.font;
                }
                else {
                    font = DefaultFonts.getDefaultFont(current_node.default_font);
                }

                var adjust = FONT_ADJUST[ClientPlatformSupport.getOS()];
                var target_pt_size = font.size;
                var current_pt_size = target_pt_size + adjust.point_size;
                var horizontal_scaling_factor = 1.0;
                var font_property = FontUtils.makeFontDescriptor(_.extend(font, {point_size: current_pt_size}));

                // Fit each fragment and choose the most narrow scaling
                _.each(shape_json["fragments"], function(fragment) {
                    var fragment_scaling = scale_text(ctx, font_property, fragment["text"], fragment.w + adjust.limit_width);

                    // If fragments require different scaling factors within the same multiline text shape,
                    // the smallest scaling factor is used for the whole shape.
                    if (fragment_scaling < horizontal_scaling_factor) {
                        horizontal_scaling_factor = fragment_scaling;
                    }
                });

                var init_font = _.clone(font);
                var initial_values = builldInitialValuesWithLayer(shape_json, fields, {
                    "fragments": shape_json["fragments"],
                    "font": _.extend(init_font, {
                        horizontal_scale: horizontal_scaling_factor
                    })
                });

                return Object.create(MultiLineTextPrototype, initial_values);
            }
        },
        "text": {
            "type_label": "webtext",
            "parsefunc": function(shape_json, current_node, rendering_context, model_fonts) {
                var hasfont =  _.has(shape_json, 'font');
                var fields = hasfont ? ['color', 'text', 'x', 'y', 'w', 'h'] : ['color', 'text', 'x', 'y'];
                var font;
                var ctx = rendering_context.getCanvasContext();

                if (hasfont) {
                    font = shape_json.font;
                }
                else {
                    var font_index = DefaultFonts.getDefaultFontIndex(current_node.default_font);
                    font = model_fonts[font_index];
                }

                var limits = {
                    w: shape_json["w"],
                    h: shape_json["h"]
                };

                var adjust = FONT_ADJUST[ClientPlatformSupport.getOS()];
                var target_pt_size = font.size;
                var current_pt_size = target_pt_size + adjust.point_size;
                var font_property = FontUtils.makeFontDescriptor(_.extend(font, {point_size: current_pt_size}));
                var horizontal_scaling_factor = scale_text(ctx, font_property, shape_json["text"], limits.w + adjust.limit_width);

                var init_font = _.clone(font);
                var initial_values = builldInitialValuesWithLayer(shape_json, fields, {
                    "font": _.extend(init_font, {
                        horizontal_scale: horizontal_scaling_factor
                    })
                });

                return Object.create(TextPrototype, initial_values, {
                    "x": shape_json["x"]
                });
            }
        },
        "push_transform": {
            "type_label": "push_transform",
            "prototype_object": PushTransformPrototype,
            "field_names": ["matrix"]
        },
        "push_rot_orig": {
            "type_label": "push_rot_orig",
            "prototype_object": PushRotOrigPrototype,
            "field_names": ["t", "x", "y"]
        },
        "pop_transform": {
            "type_label": "pop_transform",
            "prototype_object": PopTransformPrototype,
            "field_names": []
        },
        "set_comp": {
            "type_label": "set_comp",
            "prototype_object": NotImplementedShapePrototype,
            "field_names": []
        }
    };

    return {
        createShapeFromJSON: function(shape_json, current_node, rendering_context, model_fonts) {
            var shape_type = shape_json.type;

            var shape_spec = typemap[shape_type];

            if (_.has(shape_spec, "parsefunc")) {
                return shape_spec["parsefunc"](shape_json, current_node, rendering_context, model_fonts);
            }
            else {
                var field_names = shape_spec["field_names"];
                var prototype = shape_spec["prototype_object"];

                return Object.create(prototype, builldInitialValuesWithLayer(shape_json, field_names));
            }
        },

        createLayerlessShapeFromJSON: function(shape_json, current_node, rendering_context, model_fonts, extrafields) {
            var shape_type = shape_json.type;

            var shape_spec = typemap[shape_type];

            if (_.has(shape_spec, "parsefunc")) {
                return shape_spec["parsefunc"](shape_json, current_node, rendering_context, model_fonts);
            }
            else {
                var field_names = shape_spec["field_names"];
                var prototype = shape_spec["prototype_object"];

                return Object.create(prototype, builldInitialValues(shape_json, field_names, extrafields));
            }
        }
    };

// end define
});
