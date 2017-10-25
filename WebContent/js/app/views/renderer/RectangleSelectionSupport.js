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
    var RectangleSelectionSupportPrototype = {
        rectangleIntersectModel: function(selection_rect, model) {
            return _.reduce(SelectionCommon.getSelectableNodesForModel(model), function(found_nodes, node) {
                var intersection = node.intersectRectangle(selection_rect);

                if (intersection !== null) {
                    found_nodes.push(intersection);
                }

                return found_nodes;
            }, []);
        },

        rectangleIntersectModelWithOverlay: function(selection_rect, model, module_support, overlay_alpha_settings) {
            var model_intersection  = this.rectangleIntersectModel(selection_rect, model);
            var intersection_result = [];

            var all_visible_members_map = {};

            var transparent_modules = _.filter(module_support.getVisibleNetModuleNodes(), function(module_node) {
                return (module_support.isShownNetModule(module_node["id"]) || overlay_alpha_settings.regionFillAlpha <= NetModuleCommon.Settings.INTERSECTION_CUTOFF)
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

        doRectangleSelection: function(selection_rect, model, overlay_settings) {
            var module_support = NetModuleRenderingSupportFactory.create(model, overlay_settings);
            var overlay;
            var overlay_alpha_settings = overlay_settings.getAlphaSettings();

            // If overlay is enabled but no modules are enabled and intensity is 100, always return empty hit set
            if (overlay_settings.isEnabled() &&
                overlay_settings.getEnabledModules().length == 0 &&
                overlay_alpha_settings.backgroundOverlayAlpha == 1) {
                return null;
            }

            if (overlay_settings.isEnabled()) {
                overlay = model.getOverlay(overlay_settings.getEnabledID());
            }

            if (overlay_settings.isEnabled() == false ||
                overlay_alpha_settings.backgroundOverlayAlpha <= NetOverlayCommon.Thresholds.RECTANGLE_INTERSECTION_CUTOFF ||
                (overlay_settings.isEnabled() && overlay.getOverlayType() == NetOverlayCommon.OverlayTypes.TRANSPARENT_TYPE) ||
                (overlay_settings.isEnabled() && overlay.getOverlayType() == NetOverlayCommon.OverlayTypes.UNDERLAY_TYPE)) {
                return this.rectangleIntersectModel(selection_rect, model);
            }
            else {
                return this.rectangleIntersectModelWithOverlay(selection_rect, model, module_support, overlay_alpha_settings);
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
