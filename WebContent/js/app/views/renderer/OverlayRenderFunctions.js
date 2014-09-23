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
    "./renderer/NodeMoveContext"
], function (
    RenderingContextFactory,

    NetModuleCommon,
    NodeMoveContextFactory
) {
    var TRANSPARENT_TYPE = "TRANSPARENT",
        OPAQUE_TYPE = "OPAQUE",
        UNDERLAY_TYPE = "UNDERLAY";

    var OverlaySupportPrototype = {
        renderEnabledModulesForTransparentOverlay: function(rc, model, modules_list, enabled_modules, overlay_settings) {
            var enabled = _.indexBy(enabled_modules, 'id');
            var ctx = rc.getCanvasContext();

            ctx.globalCompositeOperation = "source-over";

            _.each(modules_list, function(module) {
                var show = enabled[module.id].show;
                var quickFade = module.getNameFadeMode() == NetModuleCommon.Properties.FADE_QUICKLY;
                var fill_alpha = show ? 0.0 : overlay_settings.regionFillAlpha;
                var label_alpha = quickFade ? overlay_settings.regionLabelAlpha : overlay_settings.regionBoundaryAlpha;

                if (!show) {
                    module.renderFills(rc, fill_alpha);
                }

                module.renderEdges(rc, overlay_settings.regionBoundaryAlpha);

                module.renderLabel(rc, label_alpha);
            }, this);
        },

        transparentOverlayRender: function(model, linkages, modules_list, enabled_modules, overlay_settings) {
            var null_nmc = NodeMoveContextFactory.create(null, false, null, null, null);
            var rc = RenderingContextFactory.create(model, this.renderer.ctx, 'MODEL_NODEGROUPS', null_nmc, overlay_settings);

            this.renderEnabledModulesForTransparentOverlay(rc, model, modules_list, enabled_modules, overlay_settings);

            _.each(linkages, function(linkage_node) {
                linkage_node.render(rc, overlay_settings.regionBoundaryAlpha, enabled_modules, null);
            });

            this.renderer.ctx.globalAlpha = 1.0;
        },


        renderEnabledOpaqueModuleFills: function(rc, model, modules_list, enabled_modules, ctx, overlay_settings) {
            _.each(modules_list, function(module) {
                 ctx.globalCompositeOperation = "destination-out";
                 module.renderFills(rc, 1.0);
            });
        },

        renderEnabledModulesForOpaqueOverlay: function(rc, model, modules_list, enabled_modules, linkages, ctx, overlay_settings) {
            var enabled = _.indexBy(enabled_modules, 'id');

            _.each(modules_list, function(module) {
                var show = enabled[module.id].show;

                module.render(rc, show, overlay_settings);
            });

            _.each(linkages, function(linkage_node) {
                linkage_node.render(rc, overlay_settings.regionBoundaryAlpha, enabled, null);
            });
        },

        opaqueOverlayRender: function (model, linkages, group_rects, modules_list, enabled_modules, overlay_settings) {
            var save_ctx = this.renderer.ctx;
            var null_nmc = NodeMoveContextFactory.create(null, false, null, null, null);
            var rc = RenderingContextFactory.create(model, this.renderer.ovr_ctx, 'MODEL_NODEGROUPS', null_nmc, overlay_settings);
            var rc_drill = RenderingContextFactory.create(model, this.renderer.temp_ctx, 'MODEL_NODEGROUPS', null_nmc, overlay_settings);

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
                modules_list,
                enabled_modules,
                this.renderer.ovr_ctx,
                overlay_settings
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
            this.renderer.ctx.globalAlpha = overlay_settings.backgroundOverlayAlpha;
            this.renderer.ctx.drawImage(this.renderer.config.overlay_canvas.element, 0, 0);
            this.renderer.ctx.restore();



            // Render the modules of the overlay
            // ---------------------------------

            // The last "source-over" compositing operation leaves the canvas blank
            // if no modules are rendered, so bail out in the case that no modules
            // are enabled.
            if (modules_list.length == 0) {
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
                modules_list,
                enabled_modules,
                linkages,
                this.renderer.ovr_ctx,
                overlay_settings
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

        underlayRenderIfEnabled: function(model, overlay, overlay_settings) {
            var type = overlay.ovrtype,
                enabled_modules = this.renderer.settings.overlay.enabled_modules,
                enabled_map = _.indexBy(enabled_modules, 'id'),
                modules_list = _.filter(overlay.modules, function(module) {
                    return _.has(enabled_map, module['id']);
                });

            if (type == UNDERLAY_TYPE) {
                this.transparentOverlayRender(model, overlay.linkages, modules_list, enabled_map, overlay_settings);
            }
        },

        overlayRender: function(model, overlay, overlay_settings) {
            var type = overlay.ovrtype,
                enabled_modules = this.renderer.settings.overlay.enabled_modules,
                enabled_map = _.indexBy(enabled_modules, 'id'),
                modules_list = _.filter(overlay.modules, function(module) {
                    return _.has(enabled_map, module['id']);
                });

            if (type == TRANSPARENT_TYPE) {
                this.transparentOverlayRender(model, overlay.linkages, modules_list, enabled_map, overlay_settings);
            }
            else if (type == OPAQUE_TYPE) {
                this.opaqueOverlayRender(model, overlay.linkages, overlay.group_rects, modules_list, enabled_map, overlay_settings);
            }
            else if (type == UNDERLAY_TYPE) {
                // Do nothing, as an enabled underlay has been already rendered
            }
            else {
                console.error("Unknown overlay type \'" + type + "\' in overlay \'" + overlay.id + "\'");
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
