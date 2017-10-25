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
    "./renderer/RenderingContext",

    "./overlay/NetModuleCommon",
    "./overlay/NetOverlayCommon",
    "./renderer/NodeMoveContext",
    "./renderer/NetModuleRenderingSupport"

], function (
    RenderingContextFactory,

    NetModuleCommon,
    NetOverlayCommon,
    NodeMoveContextFactory,
    NetModuleRenderingSupportFactory

) {
    var OverlaySupportPrototype = {
        renderEnabledModulesForTransparentOverlay: function(rc, model, module_support, alpha_settings) {
            var ctx = rc.getCanvasContext();

            ctx.globalCompositeOperation = "source-over";

            _.each(module_support.getVisibleNetModuleNodes(), function(module_node) {
                var show_module = module_support.isShownNetModule(module_node["id"]);
                var quickFade = module_node.getNameFadeMode() == NetModuleCommon.Properties.FADE_QUICKLY;
                var fill_alpha = show_module ? 0.0 : alpha_settings.regionFillAlpha;
                var label_alpha = quickFade ? alpha_settings.regionLabelAlpha : alpha_settings.regionBoundaryAlpha;
                if (! show_module) {
                    module_node.renderFills(rc, fill_alpha);
                }

                module_node.renderEdges(rc, alpha_settings.regionBoundaryAlpha);
                module_node.renderLabel(rc, label_alpha);
            }, this);
        },

        transparentOverlayRender: function(model, linkages, module_support, alpha_settings) {
            var null_nmc = NodeMoveContextFactory.create(null, false, null, null, null);
            var rc = RenderingContextFactory.create(model, this.renderer.ctx, 'MODEL_NODEGROUPS', null_nmc, alpha_settings);

            this.renderEnabledModulesForTransparentOverlay(rc, model, module_support, alpha_settings);

            _.each(linkages, function(linkage_node) {
                linkage_node.render(rc, alpha_settings.regionBoundaryAlpha, module_support, null);
            });

            this.renderer.ctx.globalAlpha = 1.0;
        },

        renderEnabledOpaqueModuleFills: function(rc, model, module_support, ctx) {
            _.each(module_support.getVisibleNetModuleNodes(), function(module) {
                 ctx.globalCompositeOperation = "destination-out";
                 module.renderFills(rc, 1.0);
            });
        },

        renderEnabledModulesForOpaqueOverlay: function(rc, model, module_support, linkages, ctx, alpha_settings) {
            _.each(module_support.getVisibleNetModuleNodes(), function(module_node) {
                var show = module_support.isShownNetModule(module_node.id);

                module_node.render(rc, show, alpha_settings);
            });

            _.each(linkages, function(linkage_node) {
                linkage_node.render(rc, alpha_settings.regionBoundaryAlpha, module_support, null);
            });
        },

        opaqueOverlayRender: function (model, linkages, group_rects, module_support, alpha_settings) {
            var save_ctx = this.renderer.ctx;
            var null_nmc = NodeMoveContextFactory.create(null, false, null, null, null);
            var rc = RenderingContextFactory.create(model, this.renderer.ovr_ctx, 'MODEL_NODEGROUPS', null_nmc, alpha_settings);
            var rc_drill = RenderingContextFactory.create(model, this.renderer.temp_ctx, 'MODEL_NODEGROUPS', null_nmc, alpha_settings);

            // TODO
            // Detailed documentation of the overlay rendering part of the pipeline
            this.renderer.setContext(this.renderer.temp_ctx);
            this.renderer.ctx.save();
            this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.renderer.ctx.clearRect(0, 0, this.renderer.config.viewport_dims.width, this.renderer.config.viewport_dims.height);
            this.renderer.ctx.restore();
            this.renderer.ctx.globalCompositeOperation = "source-over";
            this.renderer.ctx.globalAlpha = 1.0;
            this.renderer.renderSelectedGroupsByDrawLayer(rc_drill, model, 'MODEL_NODEGROUPS');


            // Render group rectangles of the overlay
            // --------------------------------------
            this.renderer.setContext(this.renderer.ovr_ctx);

            this.renderer.ctx.save();
            this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.renderer.ctx.fillStyle = "#ffffff";
            this.renderer.ctx.fillRect(0, 0, this.renderer.config.viewport_dims.width, this.renderer.config.viewport_dims.height);
            this.renderer.ctx.restore();

            _.each(group_rects, function(node) {
               node.render(rc, null);
            });

            this.renderEnabledOpaqueModuleFills(
                rc,
                model,
                module_support,
                this.renderer.ovr_ctx
            );

            // Drill
            this.renderer.ctx.save();
            this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.renderer.ctx.globalCompositeOperation = "destination-out";
            this.renderer.ctx.globalAlpha = 1.0;
            this.renderer.ctx.drawImage(this.renderer.config.temp_canvas.element, 0, 0);
            this.renderer.ctx.restore();

            this.renderer.setContext(save_ctx);
            this.renderer.ctx.save();
            this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.renderer.ctx.globalCompositeOperation = "source-over";
            this.renderer.ctx.globalAlpha = alpha_settings.backgroundOverlayAlpha;
            this.renderer.ctx.drawImage(this.renderer.config.overlay_canvas.element, 0, 0);
            this.renderer.ctx.restore();



            // Render the modules of the overlay
            // ---------------------------------

            // The last "source-over" compositing operation leaves the canvas blank
            // if no modules are rendered, so bail out in the case that no modules
            // are enabled.
            if (module_support.getVisibleNetModuleNodes().length == 0) {
                return;
            }

            this.renderer.setContext(this.renderer.ovr_ctx);

            this.renderer.ctx.save();
            this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.renderer.ctx.fillStyle = "#ffffff";
            this.renderer.ctx.fillRect(0, 0, this.renderer.config.viewport_dims.width, this.renderer.config.viewport_dims.height);
            this.renderer.ctx.restore();

            this.renderEnabledModulesForOpaqueOverlay(
                rc,
                model,
                module_support,
                linkages,
                this.renderer.ovr_ctx,
                alpha_settings
            );

            // Drill
            this.renderer.ctx.save();
            this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.renderer.ctx.globalCompositeOperation = "destination-out";
            this.renderer.ctx.globalAlpha = 1.0;
            this.renderer.ctx.drawImage(this.renderer.config.temp_canvas.element, 0, 0);
            this.renderer.ctx.restore();

            this.renderer.setContext(save_ctx);
            this.renderer.ctx.save();
            this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.renderer.ctx.globalAlpha = 1.0;
            this.renderer.ctx.globalCompositeOperation = "source-over";
            this.renderer.ctx.drawImage(this.renderer.config.overlay_canvas.element, 0, 0);
            this.renderer.ctx.restore();
        },

        overlayRender: function(model, overlay, overlay_settings, do_underlay) {
            var module_support = NetModuleRenderingSupportFactory.create(model, overlay_settings);
            var type = overlay.getOverlayType();

            if (type == NetOverlayCommon.OverlayTypes.TRANSPARENT_TYPE) {
                this.transparentOverlayRender(model, overlay.getLinkages(), module_support, overlay_settings.getAlphaSettings());
            }
            else if (type == NetOverlayCommon.OverlayTypes.OPAQUE_TYPE) {
                this.opaqueOverlayRender(model, overlay.getLinkages(), overlay.getGroupRectangles(), module_support, overlay_settings.getAlphaSettings());
            }
            else if (type == NetOverlayCommon.OverlayTypes.UNDERLAY_TYPE) {
                if (do_underlay) {
                    this.transparentOverlayRender(model, overlay.getLinkages(), module_support, overlay_settings.getAlphaSettings());
                }
            }
            else {
                throw {
                    name: 'Unknown Overlay Type Error',
                    level: 'OverlayRenderFunctions',
                    message: 'Invalid overlay type ' + type + ', must be between 0.0 and 1.0',
                    htmlMessage: "Unknown overlay type \'" + type + "\' in overlay \'" + overlay.id + "\'",
                    toString: function(){return this.name + ": " + this.message;}
                };
            }
        }
    };

    return {
        create: function(renderer) {
            var instance = Object.create(OverlaySupportPrototype, {});
            instance.renderer = renderer;
            return instance;
        }
    }
});
