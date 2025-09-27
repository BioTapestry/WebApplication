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
    "../../renderer/DashedLineSupportDetector",
    "../CommonNodeFunctions",
    "../CommonNodePrototype",
    "../LinkageIntersection",
    "../ShapeRendererFunctions",
    "../../util/renderer_math",
    "../../renderer/SelectedBoundsSupport"

], function (
    DashedLineSupportDetector,

    CommonNodeFunctions,
    CommonNodePrototype,
    LinkageIntersection,
    ShapeRendererFunctions,
    MathUtils,
    SelectedBoundsSupport
) {
    var BIOTAPESTRY_VECTOR2D_TOLERANCE = 1.0E-6;

    var LINKAGE_SEGMENT_SELECTED_FILL = "rgb(255,0,0)";

    // Linkage sign rendering constants
    // Source: Linkage.java
    // --------------------------------
    var LINKAGE_SIGN_NEGATIVE = -1;
    var LINKAGE_SIGN_NONE     =  0;
    var LINKAGE_SIGN_POSITIVE =  1;

    // Linkage tip rendering constants
    // Source: DrawTree.java
    // -------------------------------
    var NEG_THICK_ = 2;

    var PLUS_ARROW_DEPTH_ = 8.0;
    var POSITIVE_DROP_OFFSET_ = PLUS_ARROW_DEPTH_ - 1.0;
    var PLUS_ARROW_HALF_WIDTH_ = 5.0;

    // Value for INodeRenderer.POS_OFFSET = 3.0F
    //var TIP_FUDGE_ = INodeRenderer.POS_OFFSET + 1;
    var TIP_FUDGE_ = 3.0 + 1;


    // Value for GeneFree.LINE_THICK = 5.0
    // var LEVEL_FUDGE_ = POSITIVE_DROP_OFFSET_ + GeneFree.LINE_THICK + 5.0;
    var LEVEL_FUDGE_ = POSITIVE_DROP_OFFSET_ + 5.0 + 5.0;
    //var LEVEL_FUDGE_NEG_ = GeneFree.LINE_THICK + 4.0;
    var LEVEL_FUDGE_NEG_ = 5.0 + 4.0;


    // Source: ResolvedDrawStyle.java
    var RESOLVEDDRAWSTYLE_THICK_THICK      = 7;
    var RESOLVEDDRAWSTYLE_DOT_      = 4.0;
    var RESOLVEDDRAWSTYLE_DOT_SP_   = 6.0;
    var RESOLVEDDRAWSTYLE_DASH_     = 10.0;
    var RESOLVEDDRAWSTYLE_DASH_SP_  = 6.0;

    // Source: SuggestedDrawStyle.java
    var SUGGESTEDDRAWSTYLE_UNDEFINED_STYLE = -2;
    var SUGGESTEDDRAWSTYLE_VARIOUS_STYLE   = -1;
    var SUGGESTEDDRAWSTYLE_NO_STYLE        = 0;
    var SUGGESTEDDRAWSTYLE_SOLID_STYLE     = 1;
    var SUGGESTEDDRAWSTYLE_DASH_STYLE      = 2;
    var SUGGESTEDDRAWSTYLE_DOTTED_STYLE    = 3;
    
    var renderExportedShapes = function(rendering_context, intersection) {
        CommonNodeFunctions._render.call(this, rendering_context, intersection);
    };

    var renderExportedShapesWithBitmapPattern =  function(rendering_context, intersection) {
        _.each(this.base, function (shape) {
            if (shape.getType() == "path" && shape.style !== null) {
                this._renderDashedPathShapeWithBitmapPattern(rendering_context, shape);
            }
            else {
                shape.render(rendering_context, this);
            }
        }, this);
    };

    var LinkageNodeRendererPrototype = {
        _type: "linkage",
        default_font: "LINK_LABEL",
        render: function(rendering_context, intersection) {
            // If this linkage is connected to a floater node, render using the exported segment
            // geometry and place the first and/or last segments correctly.
            var nmc = rendering_context.getNodeMoveContext();
            if (nmc.isEnabled() && nmc.isConnectedLinkage(this.id)) {
                this._renderForFloater(rendering_context, intersection);
            }
            else if (intersection !== null) {
                this._renderSelected(rendering_context, intersection);
                this._renderExportedShapes(rendering_context, intersection);
            }
            else {
                this._renderExportedShapes(rendering_context, intersection);
            }
        },
        _renderExportedShapes: DashedLineSupportDetector.getSupportLevel() == DashedLineSupportDetector.EMULATED ?
            renderExportedShapesWithBitmapPattern : renderExportedShapes,
        _segmentNormal: function(segment) {
            var v = {
                x: segment.ex - segment.sx,
                y: segment.ey - segment.sy
            };

            var p = {
                x: v.y,
                y: -v.x
            };

            var dist = Math.sqrt(p.x * p.x + p.y * p.y);

            return {
                x: p.x / dist,
                y: p.y / dist
            };
        },
        _renderSegmentAsRect: function(rendering_context, segment, selected) {
            var ctx = rendering_context.getCanvasContext();

            var n = this._segmentNormal(segment);

            var width = selected ? segment.selthick : segment.thick;
            var fill_color = selected ? LINKAGE_SEGMENT_SELECTED_FILL : ShapeRendererFunctions.makeRGB(segment.color);

            ctx.beginPath();

            ctx.moveTo(segment.sx + n.x * width / 2.0, segment.sy + n.y * width / 2.0);
            ctx.lineTo(segment.sx - n.x * width / 2.0, segment.sy - n.y * width / 2.0);

            ctx.lineTo(segment.ex - n.x * width / 2.0, segment.ey - n.y * width / 2.0);
            ctx.lineTo(segment.ex + n.x * width / 2.0, segment.ey + n.y * width / 2.0);

            ctx.closePath();
            ctx.fillStyle = fill_color;

            ctx.fill();
        },
        _renderSegment: function(rendering_context, segment, selected) {
            var ctx = rendering_context.getCanvasContext();

            var width = segment.thick;
            var color = ShapeRendererFunctions.makeRGBA(segment.color);

            ctx.beginPath();
            ctx.moveTo(segment.sx, segment.sy);
            ctx.lineTo(segment.ex, segment.ey);
            ctx.closePath();

            ctx.strokeStyle = color;
            ctx.lineWidth = width;

            if (segment.style == SUGGESTEDDRAWSTYLE_DASH_STYLE) {
                ctx.setLineDash([RESOLVEDDRAWSTYLE_DASH_, RESOLVEDDRAWSTYLE_DASH_SP_]);
                ctx.stroke();
                ctx.setLineDash([])
            }
            else if (segment.style == SUGGESTEDDRAWSTYLE_DOTTED_STYLE) {
                ctx.setLineDash([RESOLVEDDRAWSTYLE_DOT_, RESOLVEDDRAWSTYLE_DOT_SP_]);
                ctx.stroke();
                ctx.setLineDash([])
            }
            else {
                ctx.stroke();
            }
        },
        _buildBitmapFillPattern: function(pattern_canvas, color_array, dash_array, linkage_width) {
            var red = color_array[0];
            var green = color_array[1];
            var blue = color_array[2];
            var CANVAS_WIDTH = dash_array[0] + dash_array[1];
            var CANVAS_HEIGHT = linkage_width;
            
            pattern_canvas.width = CANVAS_WIDTH;
            pattern_canvas.height = linkage_width;

            var ctx = pattern_canvas.getContext("2d");

            var rectangle = function(imgarray, start_x, width, height, red, green, blue, alpha) {
                var x, y, pxindex;
                var data = imgarray.data;

                for (x=start_x; x<start_x+width; x=x+1) {
                    for (y=0; y<height; y=y+1) {
                        pxindex = (x + y * imgarray.width) * 4;

                        data[pxindex + 0] = red;
                        data[pxindex + 1] = green;
                        data[pxindex + 2] = blue;
                        data[pxindex + 3] = alpha;
                    }
                }
            };

            var imgdata = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            rectangle(imgdata, 0, dash_array[0], linkage_width, red, green, blue, 255);

            ctx.putImageData(imgdata, 0, 0);
        },
        _renderSegmentWithPattern: function(rendering_context, segment, width, pattern) {
            var sx = segment.sx;
            var sy = segment.sy;
            var ex = segment.ex;
            var ey = segment.ey;
            var length = Math.sqrt( MathUtils.pointDist({x: sx, y: sy}, {x:ex, y:ey}) );

            var ctx = rendering_context.getCanvasContext();

            var radians = Math.atan2(ey - sy, ex - sx);
            if (radians < 0) {
                radians += Math.PI * 2;
            }

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(radians);

            ctx.fillStyle = pattern;
            ctx.fillRect(0, -width/2.0, length, width);

            ctx.restore();
        },
        _getTipData: function () {
            return {
                plusArrowDepth: PLUS_ARROW_DEPTH_,
                positiveDropOffset: POSITIVE_DROP_OFFSET_,
                plusArrowHalfWidth: PLUS_ARROW_HALF_WIDTH_,
                thickThick: RESOLVEDDRAWSTYLE_THICK_THICK,
                tipFudge: TIP_FUDGE_,
                levelFudge: (this.tipsign_ == LINKAGE_SIGN_NEGATIVE) ? LEVEL_FUDGE_NEG_ : LEVEL_FUDGE_
            };
        },
        _renderPositiveTip: function(rendering_context, end_segment) {
            var ctx = rendering_context.getCanvasContext();

            var mdt = this._getTipData(end_segment);

            var halfWidth;
            var dropWidth = end_segment.thick;
            if (dropWidth > mdt.thickThick) {
                halfWidth = mdt.plusArrowHalfWidth + ((dropWidth - mdt.thickThick) / 2.0);
            } else {
                halfWidth = mdt.plusArrowHalfWidth;
            }

            var endX = end_segment.ex;
            var endY = end_segment.ey;
            var runX = end_segment.rx;
            var runY = end_segment.ry;
            var normX = end_segment.nx;
            var normY = end_segment.ny;

            var offnegx = endX - (runX * (mdt.plusArrowDepth - mdt.positiveDropOffset)) - (normX * halfWidth);
            var offnegy = endY - (runY * (mdt.plusArrowDepth - mdt.positiveDropOffset)) - (normY * halfWidth);
            var offposx = endX - (runX * (mdt.plusArrowDepth - mdt.positiveDropOffset)) + (normX * halfWidth);
            var offposy = endY - (runY * (mdt.plusArrowDepth - mdt.positiveDropOffset)) + (normY * halfWidth);

            var tipx = endX + (runX * mdt.positiveDropOffset) + (runX * mdt.tipFudge);
            var tipy = endY + (runY * mdt.positiveDropOffset) + (runY * mdt.tipFudge);

            ctx.beginPath();

            ctx.moveTo(offnegx, offnegy);
            ctx.lineTo(offposx, offposy);
            ctx.lineTo(tipx, tipy);
            ctx.closePath();

            ctx.fillStyle = ShapeRendererFunctions.makeRGBA(end_segment.color);
            ctx.fill();
        },
        _renderNegativeTip: function(rendering_context, end_segment) {
            var ctx = rendering_context.getCanvasContext();

            var mdt = this._getTipData(end_segment);

            var halfWidth;
            var dropWidth = end_segment.thick;
            if (dropWidth > mdt.thickThick) {
                halfWidth = mdt.plusArrowHalfWidth + ((dropWidth - mdt.thickThick) / 2.0);
            } else {
                halfWidth = mdt.plusArrowHalfWidth;
            }

            var endX = end_segment.ex;
            var endY = end_segment.ey;
            var normX = end_segment.nx;
            var normY = end_segment.ny;

            var offnegx = endX - (normX * halfWidth);
            var offnegy = endY - (normY * halfWidth);
            var offposx = endX + (normX * halfWidth);
            var offposy = endY + (normY * halfWidth);

            ctx.beginPath();

            ctx.moveTo(offnegx, offnegy);
            ctx.lineTo(offposx, offposy);
            ctx.closePath();

            ctx.lineWidth = halfWidth;
            ctx.strokeStyle = ShapeRendererFunctions.makeRGBA(end_segment.color);
            ctx.stroke();
        },
        _renderSelected: function (rendering_context, intersection) {
            _.each(intersection.segments, function (segment) {
                this._renderSegmentAsRect(rendering_context, segment, true);
            }, this);
        },
        _renderSelectedSegmentsOnly: function (rendering_context, intersection) {
            _.each(intersection.segments, function (segment) {
                this._renderSegmentAsRect(rendering_context, segment, true);
                this._renderSegmentAsRect(rendering_context, segment, false);
            }, this);
        },
        _buildVector: function(start, end) {
            var length = Math.sqrt( MathUtils.pointDist(start, end) );
            var normal = this._segmentNormal({sx: start.x, sy: start.y, ex: end.x, ey:end.y});

            return {
                sx: start.x,
                sy: start.y,
                ex: end.x,
                ey: end.y,
                nx: normal.x,
                ny: normal.y,
                rx: (end.x - start.x) / length,
                ry: (end.y - start.y) / length
            };
        },

        _renderForFloater: function(rendering_context, intersection) {
            var nmv = rendering_context.getNodeMoveContext();
            var translate = nmv.getFloaterTranslation();

            _.each(this.segments, function (segment) {
                var sx = segment.sx;
                var sy = segment.sy;
                var ex = segment.ex;
                var ey = segment.ey;
                var linkid, linkage;

                var source;
                var target;

                var launchpad;
                var landingpad;

                var draw_segment;

                var isEndDropSegment = this.isSegmentForEndDrop(segment) || segment.isonly;

                if (this.isSegmentForStartDrop(segment) || segment.isonly) {
                    source = this.getSource();
                    if (nmv.isFloaterNode(source)) {
                        launchpad = rendering_context.getLaunchPadForTarget(source, this.getLaunchPad());
                        if (launchpad !== null) {
                            sx = launchpad.x + translate[0];
                            sy = launchpad.y + translate[1];
                        }
                    }
                }
                if (isEndDropSegment) {
                    target = this.getTarget();
                    if (nmv.isFloaterNode(target)) {
                        landingpad = rendering_context.getLandingPadForTarget(target, this.getLandingPad());
                        if (landingpad !== null) {
                            ex = landingpad.x + translate[0];
                            ey = landingpad.y + translate[1];
                        }
                    }
                }

                draw_segment = _.extend(_.clone(segment), this._buildVector({x: sx, y: sy}, {x: ex, y: ey}));

                this._renderSegment(rendering_context, draw_segment, false);

                if (this.isSegmentForEndDrop(segment)) {
                    linkid = this.getSegmentEndDropLinkRef(segment);
                }
                if (this.isSegmentDirect(segment)) {
                    linkid = this.getSegmentDirectLinkRef(segment);
                }
                if (isEndDropSegment || this.isSegmentDirect(segment)) {
                    linkage = this.getLinkageByID(linkid);
                    if (linkage.sign == LINKAGE_SIGN_POSITIVE) {
                        this._renderPositiveTip(rendering_context, draw_segment);
                    }
                }
            }, this);
        },

        _renderDashedPathShapeWithBitmapPattern: function(rendering_context, shape) {
            var width = shape.stroke[0];

            var pattern_canvas = rendering_context.getScratchCanvas();
            this._buildBitmapFillPattern(pattern_canvas, shape.color, shape.style, width);
            var pattern_ctx = pattern_canvas.getContext("2d");

            var pattern = pattern_ctx.createPattern(pattern_canvas, "repeat");

            var sx, sy, ex, ey;

            _.each(shape.segments, function (segment) {
                if (segment.type == "MOVETO") {
                    sx = segment.points[0];
                    sy = segment.points[1];
                    return;
                }

                ex = segment.points[0];
                ey = segment.points[1];

                var draw_segment = {
                    sx: sx,
                    sy: sy,
                    ex: ex,
                    ey: ey
                };

                this._renderSegmentWithPattern(rendering_context, draw_segment, width, pattern);

                sx = ex;
                sy = ey;
            }, this);
        },

        getLinkageByID: function(linkage_id) {
            return (_.has(this.linkages, linkage_id)) ? this.linkages[linkage_id] : null;
        },
        getSource: function() {
            return this.srctag;
        },
        getTarget: function() {
            return this.trg;
        },
        getLaunchPad: function() {
            return this.pad;
        },
        getLandingPad: function() {
            return this.lpad;
        },

        //
        // Segment functions
        //
        isSegmentForEndDrop:function(segment) {
            return ((!segment.islink) && (!segment.isonly) && (segment.label != "null"));
        },

        isSegmentForStartDrop: function(segment) {
            return ((segment.islink) && (segment.isonly) && (segment.label == "null"));
        },
        getSegmentLinkSegTag:function(segment) {
            if (!segment.islink) {
                throw {
                    name: 'Illegal State Exception',
                    level: 'Linkage',
                    message: 'Tried to get link segment tag',
                    htmlMessage: 'Tried to get link segment tag',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }
            return (segment.label);
        },

        getSegmentEndDropLinkRef: function(segment) {
            if (! this.isSegmentForEndDrop(segment)) {
                throw {
                    name: 'Illegal State Exception',
                    level: 'Linkage',
                    message: 'Tried to get segment end drop reference',
                    htmlMessage: 'Tried to get segment end drop reference',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }
            return (segment.label);
        },

        getSegmentDirectLinkRef: function(segment) {
            if (! this.isSegmentDirect(segment)) {
                throw {
                    name: 'Illegal State Exception',
                    level: 'Linkage',
                    message: 'Tried to get segment direct link reference',
                    htmlMessage: 'Tried to get segment direct link reference',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }
            return (segment.label);
        },

        isSegmentDirect: function(segment) {
            return (segment.isonly);
        },

        getIntersection: function () {
            return {
                id: this.id,
                name: this.name,
                _type: this._type,
                srctag: this.srctag,
                segments: this.segments,
                getType: CommonNodeFunctions._getType,
                getName: CommonNodeFunctions._getName
            };
        },
        getIntersectionBounds: function(intersection) {
            var segments = intersection.segments.length > 0 ? intersection.segments : this.segments;

            return SelectedBoundsSupport.getMaximalBounds(_.map(segments, function(segment) {
                return {
                    type: 'rect2',
                    min_x: _.min([segment.sx, segment.ex]),
                    min_y: _.min([segment.sy, segment.ey]),
                    max_x: _.max([segment.sx, segment.ex]),
                    max_y: _.max([segment.sy, segment.ey])
                };
            }));
        },

        intersectPoint: function (model_point) {
            return LinkageIntersection.linkage_point_intersect(this, model_point);
        },
        intersectRectangle: function (selection_rect) {
            return LinkageIntersection.linkage_rectangle_intersect(this, selection_rect);
        }
    };

    var prototype = Object.create(CommonNodePrototype, {});
    _.extend(prototype, LinkageNodeRendererPrototype);

    return prototype;
});