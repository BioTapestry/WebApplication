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
    "./SelectionCommon",
    "./overlay/NetModuleCommon",
    "./overlay/NetOverlayCommon",
    "./renderer/NetModuleRenderingSupport"

], function (
    SelectionCommon,
    NetModuleCommon,
    NetOverlayCommon,
    NetModuleRenderingSupportFactory
) {

    ///////////////////////////////////
    // HitBoxSearch
    ///////////////////////////////////
    //
    // A module for point intersecting a model
    //

    var HitBoxSearchPrototype = {
        ////////////////////////////////////////////////////////////////////////////
        // Private functions
        ////////////////////////////////////////////////////////////////////////////

        ////////////////////////////////
        // pointIntersectSelectableNodes
        ////////////////////////////////
        //
        // Intersects a given point with given model.
        //
        // Returns an array containing found intersections.
        //
        pointIntersectSelectableNodes: function(model_point, model) {
            var selectable_nodes = SelectionCommon.getSelectableNodesForModel(model);

            return _.reduce(selectable_nodes, function(found_nodes, node) {
                var intersection = node.intersectPoint(model_point);

                if (intersection !== null) {
                    found_nodes.push(intersection);
                }

                return found_nodes;
            }, []);
        },

        ////////////////////////////////
        // isFallThroughPoint
        ////////////////////////////////
        //
        // Determines if a point in an opaque overlay should only be intersected against
        // the components of enabled overlay modules, or also in addition against the
        // nodes of the model.
        //
        // Return true if both the module components and nodes of the model should be
        // considered in the intersection.
        //
        // Returns false if only the module components should be considered.
        //
        isFallThroughPoint: function(model_point, module_support) {
            var intersected_modules = [];

            _.each(module_support.getVisibleNetModuleNodes(), function(module_node) {
                var intersection = module_node.intersectPointBoundary(model_point);

                if (intersection == null) {
                    intersection = module_node.intersectPointInterior(model_point);
                }

                if (intersection !== null) {
                    intersected_modules.push(intersection);
                }
            });

            var found = _.find(intersected_modules, function (module_intersection) {
                return module_support.isShownNetModule(module_intersection["id"]);
            }, this);

            return found !== undefined;
        },

        ////////////////////////////////
        // pointIntersectEnabledModulesForOpaqueOverlay
        ////////////////////////////////
        //
        // Intersects given point with enabled modules of the currently enabled overlay.
        // The components of each module that are considered for the intersection depend
        // on the type of the overlay.
        //
        // Module components intersected for an opaque overlay:
        // - boundary
        // - interior
        // - label
        //
        // Returns an array containing found module intersections.
        //
        pointIntersectEnabledModulesForOpaqueOverlay: function(model_point, module_support) {
            var intersected_modules = [];

            _.each(module_support.getVisibleNetModuleNodes(), function(module_node) {
                var intersection = module_node.intersectPointBoundary(model_point);

                if (intersection == null) {
                    if (!module_support.isShownNetModule(module_node["id"])) {
                        intersection = module_node.intersectPointInterior(model_point);
                    }
                    else {
                        intersection = module_node.intersectPointLabel(model_point);
                    }
                }

                if (intersection !== null) {
                    intersected_modules.push(intersection);
                }
            });


            return intersected_modules;
        },

        ////////////////////////////////
        // pointIntersectEnabledModulesForTransparentOverlay
        ////////////////////////////////
        //
        // Intersects given point with enabled modules of the currently enabled overlay.
        // The components of each module that are considered for the intersection depend
        // on the type of the overlay.
        //
        // Module components intersected for an underlay or a transparent overlay:
        // - boundary
        // - label
        //
        // Returns an array containing found module intersections.
        //
        pointIntersectEnabledModulesForTransparentOverlay: function(model_point, module_support) {
            var intersected_modules = [];

            _.each(module_support.getVisibleNetModuleNodes(), function (module_node) {
                var intersection = module_node.intersectPointBoundary(model_point);

                if (intersection === null) {
                    intersection = module_node.intersectPointLabel(model_point);
                }

                if (intersection !== null) {
                    intersected_modules.push(intersection);
                }
            });

            return intersected_modules;
        },

        ////////////////////////////////
        // pointIntersectModelWithUnderlay
        ////////////////////////////////
        //
        // Intersects a given point with given model while an underlay or transparent overlay is enabled.
        // Both the nodes of the model and modules of the overlay are considered.
        //
        // Returns an array containing found intersections.
        //
        pointIntersectModelWithUnderlay: function(model_point, model, module_support) {
            var intersection_result = [];

            // Find the module intersections that will be returned to the caller.
            var intersected_modules_ret = this.pointIntersectEnabledModulesForTransparentOverlay(model_point, module_support);
            Array.prototype.push.apply(intersection_result, intersected_modules_ret);

            var intersected_nodes = this.pointIntersectSelectableNodes(model_point, model);
            Array.prototype.push.apply(intersection_result, intersected_nodes);

            return intersection_result;
        },

        ////////////////////////////////
        // pointIntersectModelWithOpaqueOverlay
        ////////////////////////////////
        //
        // Intersects a given point with given model while an opaque overlay is enabled.
        // Both the nodes of the model and modules of the overlay are considered.
        //
        // Returns an array containing found intersections.
        //
        pointIntersectModelWithOpaqueOverlay: function(model_point, model, module_support, regionFillAlpha) {
            var intersection_result = [];

            // Find the module intersections that will be returned to the caller.
            var intersected_modules_ret = this.pointIntersectEnabledModulesForOpaqueOverlay(model_point, module_support);

            Array.prototype.push.apply(intersection_result, intersected_modules_ret);

            var fall_through = false;

            if (regionFillAlpha <= NetModuleCommon.Settings.INTERSECTION_CUTOFF) {
                fall_through = true;
            }
            else {
                fall_through = this.isFallThroughPoint(model_point, module_support);
            }

            if (fall_through) {
                var intersected_nodes = this.pointIntersectSelectableNodes(model_point, model);
                Array.prototype.push.apply(intersection_result, intersected_nodes);
            }

            return intersection_result;
        },

        ////////////////////////////////
        // _pointIntersectModel
        ////////////////////////////////
        //
        // Intersects a given point with given model. The intersection rules depend on an overlay being enabled,
        // the type of the overlay, enabled modules in the overlay and the overlay opacity setting.
        //
        // Returns an array containing found intersections.
        //
        // Returns null if no intersection is found.
        //
        _pointIntersectModel: function(model_point, model, overlay_settings) {
            var module_support = NetModuleRenderingSupportFactory.create(model, overlay_settings);
            var overlay;
            var overlay_type;
            var alpha_settings = overlay_settings.getAlphaSettings();

            // If overlays are disabled, only intersect the nodes in the model.
            if (! overlay_settings.isEnabled()) {
                return this.pointIntersectSelectableNodes(model_point, model);
            }
            else {
                overlay = model.getOverlay(overlay_settings.getEnabledID());
                overlay_type = overlay.getOverlayType();
            }

            // Handle intersection when an overlay is enabled and it's type is transparent or underlay.
            if (overlay_type == NetOverlayCommon.OverlayTypes.UNDERLAY_TYPE ||
                overlay_type == NetOverlayCommon.OverlayTypes.TRANSPARENT_TYPE) {
                return this.pointIntersectModelWithUnderlay(model_point, model, module_support);
            }

            // If the overlay type is opaque, no modules are enabled and the opacity of the overlay is set to maximum,
            // there is nothing to intersect. Therefore return null.
            if (module_support.getVisibleNetModuleNodes().length == 0 &&
                alpha_settings.backgroundOverlayAlpha == 1) {
                return null;
            }

            // Do intersection with opaque overlay rules.
            return this.pointIntersectModelWithOpaqueOverlay(model_point, model, module_support, alpha_settings.regionFillAlpha);
        }
    };

    return {
        create: function(config) {
            var obj = Object.create(HitBoxSearchPrototype, {});

            if (!_.has(config, 'renderer')) {
                console.error("Field \'renderer\' not set in configuration object.");
                return undefined;
            }

            obj.renderer = config.renderer;

            return obj;
        }
    };

// end define
});
