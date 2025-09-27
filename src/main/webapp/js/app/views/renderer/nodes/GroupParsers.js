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
    "../BioTapestryConstants",
    "./NodeFactory",
    "./ShapeFactory"
], function (
    BioTapestryConstants,
    NodeFactory,
    ShapeFactory
) {
    var MODULE_MASK_DEFAULT_FILL = [255, 0, 0];
    var OVERLAY_TYPE_TRANSPARENT = "TRANSPARENT";
    var OVERLAY_TYPE_OPAQUE = "OPAQUE";

    var NET_MODULE_FULL_DRAW_SHAPE    = 0;
    var NET_MODULE_COMPONENT_SHAPE    = 1;
    var NET_MODULE_AUTO_MEMBER_SHAPE  = 2;
    var NET_MODULE_NON_MEMBER_SHAPE   = 3;
    var NET_MODULE_TITLE_SHAPE        = 4;

    ////////////////////////////////////////////////////////////////////////////
    // Constants from Java source
    ////////////////////////////////////////////////////////////////////////////

    // Source: SuggestedDrawStyle.java
    var SUGGESTEDDRAWSTYLE_UNDEFINED_STYLE = -2;
    var SUGGESTEDDRAWSTYLE_VARIOUS_STYLE   = -1;
    var SUGGESTEDDRAWSTYLE_NO_STYLE        = 0;
    var SUGGESTEDDRAWSTYLE_SOLID_STYLE     = 1;

    var GroupParserPrototype = {
        _parseShapeArray: function(shape_array, target_array, current_node, rendering_context) {
            shape_array.sort(function(a, b) {
                return a.layer[0] - b.layer[0] || a.layer[1] - b.layer[1]
            });
            _.each(shape_array, function(shape_json) {
                if (_.has(shape_json, "color")) {
                    shape_json.color[3] = 1.0;
                }

                var shape = ShapeFactory.createShapeFromJSON(shape_json, current_node, rendering_context, this._model_fonts);

                target_array.push(shape);
            }, this);
        },

        _parseLayerlessShapeArray: function(shape_array, target_array, current_node, rendering_context) {
            _.each(shape_array, function(shape_json) {
                if (_.has(shape_json, "color")) {
                    shape_json.color[4] = 1.0;
                }
                var shape = ShapeFactory.createLayerlessShapeFromJSON(shape_json, current_node, rendering_context, this._model_fonts);

                target_array.push(shape);
            }, this);
        },

        ////////////////////////////////
        // _processNetModuleLinkageSegments
        ////////////////////////////////
        //
        // Adds rendering-related information to exported linkage segments:
        // - Default alpha value (1.0) to the exported RGB color
        // - Add default "style" field if it is not defined
        //
        _processNetModuleLinkageSegments: function(segment_array) {
            var processed_segments = [];

            _.each(segment_array, function(segment) {
                var processed = _.clone(segment);

                // Default alpha
                if (processed.color.length == 3) {
                    processed.color.push(1.0);
                }
                else {
                    processed.color[3] = 1.0;
                }

                // Default style
                if (processed.style === undefined) {
                    processed.style = SUGGESTEDDRAWSTYLE_SOLID_STYLE;
                }

                processed_segments.push(processed);
            }, this);

            return processed_segments;
        },

        _parseNetModuleLinkage: function(linkage_data) {
            var linkage = NodeFactory.createNodeFromJSON(linkage_data);
            linkage.segments = linkage_data.segments;

            // Find the source module
            var linkage_key = _.keys(linkage.linkages)[0];
            linkage.source_module_id  = linkage.linkages[linkage_key].srcmodule;

            linkage.segments = this._processNetModuleLinkageSegments(linkage_data.segments);
            return linkage;
        },

        _createNetOverlayGroup: function(group_info, rendering_context) {
            var self = this,
                group = NodeFactory.createNodeFromJSON(group_info);

            _.each(group_info.modules, function(module_data) {
                var module = self._createNetModuleGroup(module_data, rendering_context, group.getOverlayType());
                group.modules.push(module);
                group.module_map[module.id] = module;
            });

            this._parseShapeArray(group_info.shapes, group.group_rects, group, rendering_context);

            // Parse the NetModuleLinkages of the overlay
            _.each(group_info.linkages, function(linkage_data) {
                var linkage = self._parseNetModuleLinkage(linkage_data);
                group.linkages.push(linkage);
            });

            return group;
        },

        _createNetModuleGroup: function(group_info, rendering_context, overlay_type) {
            var group = NodeFactory.createNodeFromJSON(group_info);

            this._parseShapeArray(group_info.edges, group.edges, group, rendering_context);
            this._parseShapeArray(group_info.fills, group.fills, group, rendering_context);
            this._parseShapeArray(group_info.label, group.label, group, rendering_context);

            var out_rectangles = _.chain(group_info["shape"])
                .filter(function(taggedshape) {
                    return taggedshape["type"] == NET_MODULE_NON_MEMBER_SHAPE;
                })
                .map(function(taggedshape) {
                    return taggedshape["rect"];
                })
                .value();
            this._parseLayerlessShapeArray(out_rectangles, group.out_rectangles, group, rendering_context);

            var interior_rectangles = _.chain(group_info["shape"])
                .filter(function(taggedshape) {
                    var type = taggedshape["type"];
                    return type != NET_MODULE_NON_MEMBER_SHAPE && type != NET_MODULE_FULL_DRAW_SHAPE;
                })
                .map(function(taggedshape) {
                    return taggedshape["rect"];
                })
                .value();

            this._parseLayerlessShapeArray(interior_rectangles, group.interior_rectangles, group, rendering_context);

            return group;
        },

        _createGroupNodeGroup: function(group_info, rendering_context) {
            var group = NodeFactory.createNodeFromJSON(group_info);

            this._parseShapeArray(group_info.toggled, group.toggled, group, rendering_context);
            this._parseShapeArray(group_info.nontoggled, group.nontoggled, group, rendering_context);

            return group;
        },

        _createGroup: function(group_info, rendering_context) {
            var group = NodeFactory.createNodeFromJSON(group_info);

            this._parseShapeArray(group_info.shapes, group.base, group, rendering_context);

            if (_.has(group_info, 'selected_shapes')) {
                this._parseShapeArray(group_info.selected_shapes, group.selected, group, rendering_context);
            }

            return group;
        },

        parseGroup: function(group_data, rendering_context) {
            var group;

            if (group_data.type == 'net_module') {
                group = this._createNetModuleGroup(group_data, rendering_context);
            }
            else if (group_data.type == 'group') {
                group = this._createGroupNodeGroup(group_data, rendering_context);
            }
            else if (group_data.type == "gene") {
                group = this._createGroup(group_data, rendering_context);
                this._parseShapeArray(group_data.padshapes, group.padshapes, group, rendering_context);
            }
            else {
                group = this._createGroup(group_data, rendering_context);
            }

            if (_.has(group_data, 'bounds')) {
                group.bounds = _.map(group_data.bounds, function(bound) {
                    return _.clone(bound);
                });
            }

            if (group_data.type == 'linkage') {
                if (_.has(group_data, 'segments')) {
                    group.segments = this._processNetModuleLinkageSegments(group_data.segments);
                    group.srctag = group_data.srctag;
                }
                else {
                    console.warn("Linkage node \'" + group_data['id'] + "\' has no segments.");
                    group.segments = [];
                }
            }

            return group;
        }
    };

    return {
        create: function(model_fonts) {
            return Object.create(GroupParserPrototype, {
                _model_fonts: {
                    value: model_fonts,
                    enumerable: true
                }
            });
        }
    };

// end define
});
