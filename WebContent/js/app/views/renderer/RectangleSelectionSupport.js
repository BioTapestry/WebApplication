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
    var RectangleSelectionSupportPrototype = {
        rectangle_intersect_model: function(selection_rect, model) {
            return _.reduce(SelectionCommon.getSelectableNodesForModel(model), function(found_nodes, node) {
                var intersection = node.intersectRectangle(selection_rect);

                if (intersection !== null) {
                    found_nodes.push(intersection);
                }

                return found_nodes;
            }, []);
        },

        rectangle_intersect_model_with_overlay: function(selection_rect, model, overlay_settings, overlay_alpha_settings) {
            // TODO
            // Should use CanvasRenderer._getOverlayForModel
            var overlay = model.getOverlay(overlay_settings["id"]);
            var enabled_modules = this.renderer.settings.overlay.enabled_modules;
            var enabled_map = _.indexBy(enabled_modules, 'id');
            var modules_list = _.filter(overlay.modules, function(module) {
                return _.has(enabled_map, module['id']);
            });

            var model_intersection  = this.rectangle_intersect_model(selection_rect, model);
            var intersection_result = [];

            var all_visible_members_map = {};

            var transparent_modules = _.filter(modules_list, function(module_node) {
                return (enabled_map[module_node["id"]].show == true || overlay_alpha_settings.regionFillAlpha <= NetModuleCommon.Settings.INTERSECTION_CUTOFF)
            });

            _.each(transparent_modules, function(module_node) {
                _.each(module_node.getMembers(), function(module_member_id) {
                    all_visible_members_map[module_member_id] = true;
                });
            });

            _.each(model_intersection, function(intersection) {
                var type = intersection.getType();

                if (_.has(all_visible_members_map, intersection["id"])) {
                    intersection_result.push(intersection);
                }

                if (type == "linkage") {
                    // The intersection object of the Linkage contains the list of segments that are inside the
                    // selection rectangle. This list has to be filtered down to the segments which have
                    // at least one endpoint inside the modules.
                    var intersected_segments = _.filter(intersection.segments, function(segment) {
                        var p1 = {
                            x: segment.sx,
                            y: segment.sy
                        };
                        var p2 = {
                            x: segment.ex,
                            y: segment.ey
                        };

                        var intersects_module = _.find(transparent_modules, function(module_node) {
                            var p1_int = module_node.intersectPointInterior(p1);
                            var p2_int = module_node.intersectPointInterior(p2);
                            return (p1_int !== null || p2_int !== null);
                        });

                        return intersects_module !== undefined;
                    });

                    if (intersected_segments.length > 0) {
                        intersection.segments = intersected_segments;
                        intersection_result.push(intersection);
                    }
                }
            });

            return intersection_result;
        },

        doRectangleSelection: function(selection_rect, model, overlay_settings, overlay_alpha_settings) {
            var overlay;

            // If overlay is enabled but no modules are enabled and intensity is 100, always return empty hit set
            if (overlay_settings.id !== null &&
                overlay_settings.enabled_modules.length == 0 &&
                overlay_alpha_settings.backgroundOverlayAlpha == 1) {
                return null;
            }

            if (overlay_settings.id !== null) {
                overlay = model.getOverlay(overlay_settings["id"]);
            }

            if (overlay_settings.id === null ||
                overlay_alpha_settings.backgroundOverlayAlpha <= 0.5 ||
                (overlay_settings.id !== null && overlay.getOverlayType() == "TRANSPARENT") ||
                (overlay_settings.id !== null && overlay.getOverlayType() == "UNDERLAY")) {
                return this.rectangle_intersect_model(selection_rect, model, overlay_settings, overlay_alpha_settings);
            }
            else {
                return this.rectangle_intersect_model_with_overlay(selection_rect, model, overlay_settings, overlay_alpha_settings);
            }
        }
    };

    return {
        create: function(config) {
            var obj = Object.create(RectangleSelectionSupportPrototype, {});

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
