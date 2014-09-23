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
    "./overlay/NetModuleCommon"
], function (
    SelectionCommon,
    NetModuleCommon
) {

    ///////////////////////////////////
    // HitBoxSearch
    ///////////////////////////////////
    //
    // A module for point intersecting a model
    //

    ////////////////////////////////////////////////////////////////////////////
    // Private functions
    ////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////
    // point_intersect_model
    ////////////////////////////////
    //
    // Intersects a given point with given model.
    //
    // Returns an array containing found intersections.
    //
    var point_intersect_model = function(model_point, model, overlay_settings, overlay_alpha_settings) {
        var selectable_nodes = SelectionCommon.getSelectableNodesForModel(model);

        return _.reduce(selectable_nodes, function(found_nodes, node) {
            var intersection = node.intersectPoint(model_point);

            if (intersection !== null) {
                found_nodes.push(intersection);
            }

            return found_nodes;
        }, []);
    };

    ////////////////////////////////
    // is_fall_through_point
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
    var is_fall_through_point = function(model_point, model, overlay_settings, overlay_alpha_settings) {
        var overlay = model.getOverlay(overlay_settings["id"]);
        var enabled_modules = this.renderer.settings.overlay.enabled_modules;
        var enabled_map = _.indexBy(enabled_modules, 'id');
        var modules_list = _.filter(overlay.modules, function(module) {
            return _.has(enabled_map, module['id']);
        });
        var intersected_modules = [];

        _.each(modules_list, function(module_node) {
            var intersection = module_node.intersectPointBoundary(model_point);

            if (intersection == null) {
                intersection = module_node.intersectPointInterior(model_point);
            }

            if (intersection !== null) {
                intersected_modules.push(intersection);
            }
        });

        var found = _.find(intersected_modules, function (module_intersection) {
            var module_id = module_intersection["id"];
            return enabled_map[module_id].show == true;
        }, this);

        return found !== undefined;
    };

    ////////////////////////////////
    // point_intersect_enabled_modules
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
    // Module components intersected for an underlay or a transparent overlay:
    // - boundary
    // - label
    //
    // Returns an array containing found module intersections.
    //
    var point_intersect_enabled_modules = function(model_point, model, overlay_settings) {
        var overlay = model.getOverlay(overlay_settings["id"]);
        var enabled_modules = this.renderer.settings.overlay.enabled_modules;
        var enabled_map = _.indexBy(enabled_modules, 'id');
        var modules_list = _.filter(overlay.modules, function(module) {
            return _.has(enabled_map, module['id']);
        });
        var intersected_modules = [];

        // Opaque overlay and unrevealed module - boundary and interior
        // Opaque overlay and revealed module   - boundary only
        if (overlay.getOverlayType() == "OPAQUE") {
            _.each(modules_list, function(module_node) {
                var intersection = module_node.intersectPointBoundary(model_point);

                if (intersection == null) {
                    if (enabled_map[module_node["id"]].show == false) {
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
        }
        // Transparent overlay and unrevealed module - boundary only
        else {
            _.each(modules_list, function (module_node) {
                var intersection = module_node.intersectPointBoundary(model_point);

                if (intersection === null) {
                    intersection = module_node.intersectPointLabel(model_point);
                }

                if (intersection !== null) {
                    intersected_modules.push(intersection);
                }
            });
        }

        return intersected_modules;
    };

    ////////////////////////////////
    // point_intersect_model_with_underlay
    ////////////////////////////////
    //
    // Intersects a given point with given model while an underlay or transparent overlay is enabled.
    // Both the nodes of the model and modules of the overlay are considered.
    //
    // Returns an array containing found intersections.
    //
    var point_intersect_model_with_underlay = function(model_point, model, overlay_settings, overlay_alpha_settings) {
        var intersection_result = [];

        // Find the module intersections that will be returned to the caller.
        var intersected_modules_ret = this._point_intersect_enabled_modules(model_point, model, overlay_settings);
        Array.prototype.push.apply(intersection_result, intersected_modules_ret);

        var intersected_nodes = point_intersect_model(model_point, model, overlay_settings, overlay_alpha_settings);
        Array.prototype.push.apply(intersection_result, intersected_nodes);

        return intersection_result;
    };

    ////////////////////////////////
    // point_intersect_model_with_overlay
    ////////////////////////////////
    //
    // Intersects a given point with given model while an opaque overlay is enabled.
    // Both the nodes of the model and modules of the overlay are considered.
    //
    // Returns an array containing found intersections.
    //
    var point_intersect_model_with_overlay = function(model_point, model, overlay_settings, overlay_alpha_settings) {
        var intersection_result = [];

        // Find the module intersections that will be returned to the caller.
        var intersected_modules_ret = this._point_intersect_enabled_modules(model_point, model, overlay_settings);
        Array.prototype.push.apply(intersection_result, intersected_modules_ret);

        var fall_through = false;

        if (overlay_alpha_settings.regionFillAlpha <= NetModuleCommon.Settings.INTERSECTION_CUTOFF) {
            fall_through = true;
        }
        else {
            fall_through = this._is_fall_through_point(model_point, model, overlay_settings, overlay_alpha_settings);
        }

        if (fall_through) {
            var intersected_nodes = point_intersect_model(model_point, model, overlay_settings, overlay_alpha_settings);
            Array.prototype.push.apply(intersection_result, intersected_nodes);
        }

        return intersection_result;
    };

    var HitBoxSearchPrototype = {
        _is_fall_through_point: is_fall_through_point,

        _point_intersect_enabled_modules: point_intersect_enabled_modules,

        _point_intersect_model: point_intersect_model,

        _point_intersect_model_with_underlay: point_intersect_model_with_underlay,
        _point_intersect_model_with_overlay: point_intersect_model_with_overlay,


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
        _pointIntersectModel: function(model_point, model, overlay_settings, overlay_alpha_settings, rendering_context) {
            var overlay;
            var overlay_type;

            // If overlays are disabled, only intersect the nodes in the model.
            if (overlay_settings.id === null) {
                return this._point_intersect_model(model_point, model, overlay_settings, overlay_alpha_settings)
            }
            else {
                overlay = model.getOverlay(overlay_settings["id"]);
                overlay_type = overlay.getOverlayType();
            }

            // Handle intersection when an overlay is enabled and it's type is transparent or underlay.
            if (overlay_type == "UNDERLAY" ||
                overlay_type == "TRANSPARENT") {
                return this._point_intersect_model_with_underlay(model_point, model, overlay_settings, overlay_alpha_settings);
            }

            // If the overlay type is opaque, no modules are enabled and the opacity of the overlay is set to maximum,
            // there is nothing to intersect. Therefore return null.
            if (overlay_settings.enabled_modules.length == 0 &&
                overlay_alpha_settings.backgroundOverlayAlpha == 1) {
                return null;
            }

            // Do intersection with opaque overlay rules.
            return this._point_intersect_model_with_overlay(model_point, model, overlay_settings, overlay_alpha_settings);
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
