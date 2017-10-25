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
    "../ShapeRendererFunctions",
    "../../util/renderer_math",

    "./Linkage"

], function (
    DashedLineSupportDetector,
    ShapeRendererFunctions,
    MathUtils,

    LinkageNodeRendererPrototype
) {
    ///////////////////////////////////
    // NetModuleLinkage
    ///////////////////////////////////
    //
    // Prototype of NetModuleLinkage renderer
    //

    ////////////////////////////////////////////////////////////////////////////
    // Private constants
    ////////////////////////////////////////////////////////////////////////////

    // Currently, the locations of the landing pads of the target modules
    // are not known in the client. If the end drop or direct segments
    // are rendered using the known segment geometry only, the end points of
    // the segments and the linkage tips will overlap the boundary of the
    // target module. Therefore, the length of direct or end drop segments
    // is decreased depending on the linkage tip type.
    var SEGMENT_CUT_FOR_POSITIVE_TIP = 10.0;
    var SEGMENT_CUT_FOR_NEGATIVE_TIP = 5.0;

    ////////////////////////////////////////////////////////////////////////////
    // Constants from Java source
    ////////////////////////////////////////////////////////////////////////////

    // Linkage sign rendering constants
    // Source: Linkage.java
    // --------------------------------
    var LINKAGE_SIGN_NEGATIVE = -1;
    var LINKAGE_SIGN_NONE     =  0;
    var LINKAGE_SIGN_POSITIVE =  1;

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


    ////////////////////////////////
    // renderSingleSegmentUsingCanvas
    ////////////////////////////////
    //
    // Renders a segment of a NetModuleLinkage using HTML5 Canvas.
    //
    function renderSingleSegmentUsingCanvas(segment, alpha, rendering_context) {
        var sx = segment.sx;
        var sy = segment.sy;
        var ex = segment.ex;
        var ey = segment.ey;
        var linkid, linkage;

        var draw_segment;

        var isEndDropSegment = this.isSegmentForEndDrop(segment) || segment.isonly;

        if (this.isSegmentForEndDrop(segment)) {
            linkid = this.getSegmentEndDropLinkRef(segment);
        }
        if (this.isSegmentDirect(segment)) {
            linkid = this.getSegmentDirectLinkRef(segment);
        }

        // Scale down the length of the segment if needed
        if (isEndDropSegment || this.isSegmentDirect(segment)) {
            linkage = this.getLinkageByID(linkid);

            if (linkage.sign == LINKAGE_SIGN_POSITIVE) {
                draw_segment = this.getDrawableSegment(segment, -SEGMENT_CUT_FOR_POSITIVE_TIP);
            }
            else if (linkage.sign == LINKAGE_SIGN_NEGATIVE) {
                draw_segment = this.getDrawableSegment(segment, -SEGMENT_CUT_FOR_NEGATIVE_TIP);
            }
        }
        else {
            draw_segment = _.extend(_.clone(segment), this._buildVector({x: sx, y: sy}, {x: ex, y: ey}))
        }

        draw_segment.color[3] = alpha;
        this._renderSegment(rendering_context, draw_segment, false);

        if (isEndDropSegment || this.isSegmentDirect(segment)) {
            linkage = this.getLinkageByID(linkid);
            if (linkage.sign == LINKAGE_SIGN_POSITIVE) {
                this._renderPositiveTip(rendering_context, draw_segment);
            }
            else if (linkage.sign == LINKAGE_SIGN_NEGATIVE) {
                this._renderNegativeTip(rendering_context, draw_segment);
            }
        }
    }

    ////////////////////////////////
    // renderSegmentsUsingCanvas
    ////////////////////////////////
    //
    // Renders all visible segments of a NetModuleLinkage.
    //
    // This function is used in browsers that support either setLineDash or mozDash
    // in their Canvas implementation.
    //
    var renderSegmentsUsingCanvas = function(rendering_context, alpha, module_support, intersection) {
        // If the source module is not enabled in the overlay, none of the linkages will be draw
        if (!module_support.isEnabledNetModule(this.source_module_id)) {
            return;
        }

        _.each(this.segments, function (segment) {
            if (! this.isSegmentVisible(segment, module_support)) {
                return;
            }

            renderSingleSegmentUsingCanvas.call(this, segment, alpha, rendering_context);
        }, this);
    };

    ////////////////////////////////
    // renderSegmentsUsingBitmapPattern
    ////////////////////////////////
    //
    // Renders all visible segments of a NetModuleLinkage, using a bitmap pattern
    // for segments that have been set to use the dashed or dotted line style.
    //
    // This function is used in browsers that do not support either setLineDash or mozDash
    // in their Canvas implementation.
    //
    // Any segments that do not use the dashed or dotted line style are rendered using
    // renderSingleSegmentUsingCanvas.
    //
    var renderSegmentsUsingBitmapPattern = function(rendering_context, alpha, module_support, intersection) {
        // If the source module is not enabled in the overlay, none of the linkages will be draw
        if (!module_support.isEnabledNetModule(this.source_module_id)) {
            return;
        }

        if (this.segments.length == 0) {
            return;
        }

        _.each(this.segments, function (segment) {
            var color = segment.color;
            var width = segment.thick;
            var style;

            // If the segment is not rendered using the dashed or dotted line style,
            // it can be rendered using standard Canvas calls.
            if (segment.style <= SUGGESTEDDRAWSTYLE_SOLID_STYLE) {
                _.bind(renderSingleSegmentUsingCanvas, this)(segment, alpha, rendering_context);
                return;
            }
            else if (segment.style == SUGGESTEDDRAWSTYLE_DASH_STYLE) {
                style = [RESOLVEDDRAWSTYLE_DASH_, RESOLVEDDRAWSTYLE_DASH_SP_];
            }
            else if  (segment.style == SUGGESTEDDRAWSTYLE_DOTTED_STYLE) {
                style = [RESOLVEDDRAWSTYLE_DOT_, RESOLVEDDRAWSTYLE_DOT_SP_];
            }

            var pattern_canvas = rendering_context.getScratchCanvas();
            this._buildBitmapFillPattern(pattern_canvas, color, style, width);
            var pattern_ctx = pattern_canvas.getContext("2d");
            var pattern = pattern_ctx.createPattern(pattern_canvas, "repeat");

            if (! this.isSegmentVisible(segment, module_support)) {
                return;
            }

            var sx = segment.sx;
            var sy = segment.sy;
            var ex = segment.ex;
            var ey = segment.ey;
            var linkid, linkage;

            var draw_segment;

            var isEndDropSegment = this.isSegmentForEndDrop(segment) || segment.isonly;

            if (this.isSegmentForEndDrop(segment)) {
                linkid = this.getSegmentEndDropLinkRef(segment);
            }
            if (this.isSegmentDirect(segment)) {
                linkid = this.getSegmentDirectLinkRef(segment);
            }

            // Scale down the length of the segment if needed
            if (isEndDropSegment || this.isSegmentDirect(segment)) {
                linkage = this.getLinkageByID(linkid);

                if (linkage.sign == LINKAGE_SIGN_POSITIVE) {
                    draw_segment = this.getDrawableSegment(segment, -SEGMENT_CUT_FOR_POSITIVE_TIP);
                }
                else if (linkage.sign == LINKAGE_SIGN_NEGATIVE) {
                    draw_segment = this.getDrawableSegment(segment, -SEGMENT_CUT_FOR_NEGATIVE_TIP);
                }
            }
            else {
                draw_segment = _.extend(_.clone(segment), this._buildVector({x: sx, y: sy}, {x: ex, y: ey}))
            }

            draw_segment.color[3] = alpha;
            this._renderSegmentWithPattern(rendering_context, draw_segment, 5.0, pattern);

            if (isEndDropSegment || this.isSegmentDirect(segment)) {
                linkage = this.getLinkageByID(linkid);
                if (linkage.sign == LINKAGE_SIGN_POSITIVE) {
                    this._renderPositiveTip(rendering_context, draw_segment);
                }
                else if (linkage.sign == LINKAGE_SIGN_NEGATIVE) {
                    this._renderNegativeTip(rendering_context, draw_segment);
                }
            }
        }, this);
    };

    var NetModuleLinkageNodeRendererPrototype = {
        _type: "net_module_linkage",
        default_font: "LINK_LABEL",
        render: function(rendering_context, alpha, module_support, intersection) {
            this.renderSegments(rendering_context, alpha, module_support, intersection);
        },
        ////////////////////////////////
        // renderSegments
        ////////////////////////////////
        //
        // Renders all visible segments of a NetModuleLinkage. Delegates to renderSegmentsUsingCanvas
        // or renderSegmentsUsingBitmapPattern, depending on the Canvas implementation of the browser.
        //
        // TODO - Fix rendering dashed or dotted segments using native Canvas implementation.
        // Currently, dashed or dotted segments are always rendered using the bitmap pattern
        // emulation. Solid segments will be rendered using renderSingleSegmentUsingCanvas.
        //
        renderSegments: DashedLineSupportDetector.getSupportLevel() == DashedLineSupportDetector.EMULATED ?
            // renderSegmentsUsingBitmapPattern : renderSegmentsUsingCanvas,
            renderSegmentsUsingBitmapPattern : renderSegmentsUsingBitmapPattern,
        getDrawableSegment: function(segment, extra_length) {
            var sx = segment.sx;
            var sy = segment.sy;
            var ex = segment.ex;
            var ey = segment.ey;
            var draw_segment;
            var d, length, scale, scaled_end;

            d = {
                x: ex - sx,
                y: ey - sy
            };

            length = Math.sqrt( MathUtils.pointDist({x: 0, y: 0}, d) );

            if (length > 0) {
                scale = (length + extra_length) / length;
            }
            else {
                scale = 1.0;
            }

            scaled_end = {
                x: sx + d.x * scale,
                y: sy + d.y * scale
            };

            draw_segment = _.extend(_.clone(segment), this._buildVector({x: sx, y: sy}, scaled_end));
            return draw_segment;
        },
        ////////////////////////////////
        // isSegmentVisible
        ////////////////////////////////
        //
        // Answers if a NetModuleLinkage segment should be drawn,
        // given the enabled modules of an overlay.
        //
        isSegmentVisible: function(segment, module_support) {
            var source_module_id;
            var target_module_id;

            // At least one source/target module pair has to be enabled
            // for this segment to be visible.
            var link = _.find(segment.links, function(linkid) {
                source_module_id = this.linkages[linkid].srcmodule;
                target_module_id = this.linkages[linkid].trgmodule;

                return (module_support.isEnabledNetModule(source_module_id) && module_support.isEnabledNetModule(target_module_id));
            }, this);

            return (link !== undefined);
        },
        getLinkageByID: function(linkage_id) {
            return (_.has(this.linkages, linkage_id)) ? this.linkages[linkage_id] : null;
        },
        getSource: function() {
            return this.srcmodule;
        },
        getTarget: function() {
            return this.trgmodule;
        }
    };

    var prototype = Object.create(LinkageNodeRendererPrototype, {});
    _.extend(prototype, NetModuleLinkageNodeRendererPrototype);

    return prototype;
});
