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
    "../CommonNodeFunctions",
    "../CommonNodePrototype",
    "../RectangleSelection",
    "../../overlay/NetModuleCommon",
    "../../util/renderer_math"
], function (
    CommonNodeFunctions,
    CommonNodePrototype,
    RectangleSelectionSupport,
    NetModuleCommon,
    MathUtils
) {
    // NetModuleFree.java function calcStroke
    var MODULE_BOUNDARY_WIDTH = 4.0;

    var NetModuleRendererPrototype = {
        _type: "net_module",
        default_font: "NET_MODULE",
        renderEdges: function (rc, shape_alpha) {
            var self = this;

            _.each(this.edges, function (shape) {
                var render_shape = _.clone(shape);
                render_shape.color = _.clone(shape.color);
                render_shape.color[3] = shape_alpha;

                render_shape.render(rc, self);
            });
        },

        renderFills: function (rc, shape_alpha) {
            var self = this;

            _.each(this.fills, function (shape) {
                var render_shape = _.clone(shape);
                render_shape.color = _.clone(shape.color);
                render_shape.color[3] = shape_alpha;

                render_shape.render(rc, self);
            });
        },

        renderLabel: function (rc, shape_alpha) {
            var self = this;

            _.each(this.label, function (shape) {
                var render_shape = _.clone(shape);
                render_shape.color = _.clone(shape.color);
                render_shape.color[3] = shape_alpha;

                render_shape.render(rc, self);
            });
        },

        render: function(rc, show_components, alpha_settings) {
            var ctx = rc.getCanvasContext();
            var quickFade = this.getNameFadeMode() == NetModuleCommon.Properties.FADE_QUICKLY;
            var label_alpha = quickFade ? alpha_settings.regionLabelAlpha : alpha_settings.regionBoundaryAlpha;

            ctx.globalCompositeOperation = "destination-out";
            this.renderFills(rc, 1.0);

            ctx.globalCompositeOperation = "source-over";

            if (!show_components) {
                this.renderFills(rc, alpha_settings.regionFillAlpha);
            }

            this.renderEdges(rc, alpha_settings.regionBoundaryAlpha);

            this.renderLabel(rc, label_alpha);
        },

        getOuterBounds: function() {
            return this.outerbounds;
        },

        getNameFadeMode: function() {
            return this.nfm;
        },

        getMembers: function() {
            return this.members;
        },

        getIntersection: function (extrafields) {
            var intersection = {
                _type: this._type,
                id: this.id,
                name: this.name,
                getType: CommonNodeFunctions._getType,
                getName: CommonNodeFunctions._getName
            };

            if (_.isObject(extrafields)) {
                _.extend(intersection, extrafields);
            }

            return intersection;
        },

        intersectPointBoundary: function(model_point) {
            // TODO find correct boundary width constant from Java code
            var hit =_.find(this.edges, function(path_shape) {
                if (path_shape.getType() != "path") {
                    return;
                }

                var last_point = null;

                var found = _.find(path_shape.segments, function(segment, index, segment_array) {
                    var type = segment.type,
                        current_point,
                        dist;

                    if (type == 'MOVETO') {
                        current_point = {
                            x: segment.points[0],
                            y: segment.points[1]
                        };

                        last_point = current_point;
                        return false;
                    }

                    if (type == 'CLOSE') {
                        current_point = {
                            x: segment_array[0].points[0],
                            y: segment_array[0].points[1]
                        };

                        dist = MathUtils.distanceFromLine(last_point, current_point, model_point);
                    }

                    if (type == "LINETO") {
                        current_point = {
                            x: segment.points[0],
                            y: segment.points[1]
                        };

                        dist = MathUtils.distanceFromLine(last_point, current_point, model_point);
                        last_point = current_point;
                    }

                    return dist <= MODULE_BOUNDARY_WIDTH;
                });

                return found !== undefined;
            });

            return hit !== undefined ? this.getIntersection({component: "boundary"}) : null;
        },

        intersectPointInterior: function(model_point) {
            var hit = RectangleSelectionSupport.isPointInRectangleWH(model_point, this.getOuterBounds());

            if (hit == false) {
                hit =_.find(this.interior_rectangles, function(shape) {
                    if (shape.getType() != "rect") {
                        return false;
                    }

                    return RectangleSelectionSupport.isPointInRectangleWH(model_point, shape);
                });
            }

            var out_hit =_.find(this.out_rectangles, function(shape) {
                if (shape.getType() != "rect") {
                    return false;
                }

                return RectangleSelectionSupport.isPointInRectangleWH(model_point, shape);
            });

            return (hit !== undefined && out_hit === undefined) ? this.getIntersection({component: "interior"}) : null;
        },

        intersectPointLabel: function(model_point) {
            var is_in_bounds = RectangleSelectionSupport.isPointInRectangleWH(model_point, this.namebounds);

            return is_in_bounds ? this.getIntersection({component: "label"}) : null;
        }
    };

    var prototype = Object.create(CommonNodePrototype, {});
    _.extend(prototype, NetModuleRendererPrototype);

    return prototype;
});
