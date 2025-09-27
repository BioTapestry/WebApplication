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
    "./renderer/DashedLineSupportDetector",
    "./BioTapestryConstants",
    "./Model",
    "./nodes/GroupParsers",
    "./fonts/FontUtils",
    "./renderer/RenderingContext",
    "./nodes/ShapeRendererFunctions",
    "./HitBoxSearch",
    "./renderer/SelectedBoundsSupport",
    "./RectangleSelectionSupport",
    "./OverlayRenderFunctions",
    "./overlay/AlphaBuilder",

    "./renderer/NodeMoveContext"
], function (
    DashedLineSupportDetector,

    BioTapestryConstants,
    ModelFactory,
    GroupParsers,
    FontUtils,
    RenderingContextFactory,
    ShapeRendererFunctions,
    HitBoxSearchFactory,
    SelectedBoundsSupport,
    RectangleSelectionSupportFactory,
    OverlayRenderFunctions,
    NetModuleAlphaBuilder,

    NodeMoveContextFactory
) {
    var BioTapestryCanvasRendererPrototype = {
        group_parser: GroupParsers.create({}),

        _createOverlayCanvas: function() {
            var canvas = document.createElement('canvas');
            canvas.width = this.config.viewport_dims.width;
            canvas.height = this.config.viewport_dims.height;
            return canvas;
        },

        setElementAndContext: function(newCanvas) {
            this.config.canvas_el = newCanvas;
            this.ctx = this.config.canvas_el.getContext('2d');
        },

        setContext: function(newContext) {
            this.ctx = newContext;
        },

        setOverlayContext: function(newContext) {
            this.ovr_ctx = newContext;
        },

        ///////////////////
        // Transform API //
        ///////////////////
        context_transform: function() {
            var callargs = arguments;
            _.each(this._getContextArray(), function(ctx) {
                ctx.transform.apply(ctx, callargs);
            });
        },

        context_save: function() {
            var callargs = arguments;
            _.each(this._getContextArray(), function(ctx) {
                ctx.save.apply(ctx, callargs);
            });
        },
        
        context_restore: function() {
            var callargs = arguments;
            _.each(this._getContextArray(), function(ctx) {
                ctx.restore.apply(ctx, callargs);
            });
        },
        
        context_clearRect: function() {
            var callargs = arguments;
            _.each(this._getContextArray(), function(ctx) {
                ctx.clearRect.apply(ctx, callargs);
            });
        },          
        
        context_setTransform: function() {
            var callargs = arguments;
            _.each(this._getContextArray(), function(ctx) {
                ctx.setTransform.apply(ctx, callargs);
            });
        },        
        
        context_scale: function() {
            var callargs = arguments;
            _.each(this._getContextArray(), function(ctx) {
                ctx.scale.apply(ctx, callargs);
            });
        },

        context_translate: function() {
            var callargs = arguments;
            _.each(this._getContextArray(), function(ctx) {
                ctx.translate.apply(ctx, callargs);
            });
        },

        initialize: function() {
            this.model_cache = { };
            this._setSingleGroupRenderHandler();

            if (this.config.primary_canvas.type == 'external') {
                console.info("Using configured canvas for primary");
            }
            else if (this.config.primary_canvas.type == 'internal') {
                console.info("Using off DOM canvas for primary");
                this.config.primary_canvas.element = this._createOverlayCanvas();
            }
            else {
                console.error("Invalid configuration for overlay canvas");
            }

            if (this.config.overlay_canvas.type == 'external') {
                console.info("Using configured canvas for overlay");
            }
            else if (this.config.overlay_canvas.type == 'internal') {
                console.info("Using off DOM canvas for overlay");
                this.config.overlay_canvas.element = this._createOverlayCanvas();
            }
            else {
                console.error("Invalid configuration for overlay canvas");
            }

            if (this.config.temp_canvas.type == 'external') {
                console.info("Using configured canvas for temp");
            }
            else if (this.config.temp_canvas.type == 'internal') {
                console.info("Using off DOM canvas for temp");
                this.config.temp_canvas.element = this._createOverlayCanvas();
            }
            else {
                console.error("Invalid configuration for temp canvas");
            }

            this.ctx = this.config.primary_canvas.element.getContext('2d');
            this.view_ctx = this.ctx;

            this.ovr_ctx = this.config.overlay_canvas.element.getContext("2d");
            this.temp_ctx = this.config.temp_canvas.element.getContext("2d");

            this.viewport = {
                x: 0,
                y: 0
            };
        },

        _getContextArray: function() {
            return [
                this.ctx,
                this.ovr_ctx,
                this.temp_ctx
            ];
        },

        _setSingleGroupRenderHandler: function() {
            if (this.config.bounds_debug === true) {
                this._renderSingleGroupFN = this._renderSingleGroupDebug;
            }
            else {
                this._renderSingleGroupFN = this._renderSingleGroup;
            }
        },

        // Model API
        // ---------
        _getModelByID: function(model_key) {
            if (!_.has(this.model_cache, model_key)) {
                throw {
                    name: 'Unknown Model Error',
                    level: 'CanvasRenderer',
                    message: 'Tried to get model with unknown key \'' + model_key + '\'',
                    htmlMessage: 'Tried to get model with unknown key <b>' + model_key + '</b>',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }

            return this.model_cache[model_key];
        },

        addModel: function(model_id, overlay_array, draw_layer_groups, model_fonts) {
            var rc_for_shape_parsing = RenderingContextFactory.create(model, this.temp_ctx, {});
            var model = ModelFactory.create(
                rc_for_shape_parsing,
                model_id,
                overlay_array,
                draw_layer_groups,
                model_fonts
            );

            if (_.has(this.model_cache, model_id)) {
                console.warn("Model already exists with ID '" + model_id + "'");
            }

            this.model_cache[model_id] = model;
        },

        removeModel: function(model_id) {
            delete this.model_cache[model_id];
        },

        // Internal rendering functions
        // ----------------------------
        _renderSingleGroup: function(rendering_context, group) {
            var intersection = rendering_context.model.getIntersectionByID(group['id']);

            group.render(rendering_context, intersection);
        },

        _renderSingleGroupDebug: function(rendering_context, group) {
            var that = this,
                bound_debug_properties = {
                    color: [255, 0, 0, 255],
                    mode: 'DRAW',
                    stroke: [1, 0, 2]
                },
                bound_debug_renderers = {
                    ellipse: function(boundshape) {
                        ShapeRendererFunctions._drawEllipse(that.ctx, _.extend(boundshape, bound_debug_properties));
                    },
                    rect: function(boundshape) {
                        ShapeRendererFunctions._drawRectangle(that.ctx, _.extend(boundshape, bound_debug_properties));
                    },
                    rect2: function(boundshape) {
                        ShapeRendererFunctions._drawRectangle(that.ctx, _.extend(bound_debug_properties, {
                            x: boundshape.min_x,
                            y: boundshape.min_y,
                            w: boundshape.max_x - boundshape.min_x,
                            h: boundshape.max_y - boundshape.min_y
                        }));
                    }
                },
                intersection = rendering_context.model.getIntersectionByID(group['id']);

            group.render(rendering_context, intersection);

            _.each(group.bounds, function(boundshape) {
                if (_.has(bound_debug_renderers, boundshape.type)) {
                    bound_debug_renderers[boundshape.type](boundshape);
                }
            });
        },

        // -------------
        // Selection API
        // -------------
        setSelectedNodeIDMap: function(model_key, selected_map) {
            var model = this._getModelByID(model_key);

            if (_.isObject(selected_map)) {
                model.setSelectedNodeIDMap(selected_map);
            }
            else {
                console.warn("Parameter 'selected_map' is not an object");
            }
        },

        getSelectedNodeIDMap: function(model_key) {
            var model = this._getModelByID(model_key);

            return _.clone(model.getSelectedNodeIDMap());
        },

        getAllSelectedMap: function(model_key) {
            console.log("getAllSelectecMapForDrawLayer - defaulting to MODEL_NODEGROUPS drawlayer");

            var draw_layer_key = "MODEL_NODEGROUPS",
                model = this._getModelByID(model_key),
                selected_map = {};

            _.each(model.getDrawLayerByID(draw_layer_key).group_array, function(group) {
                selected_map[group.id] = group.getIntersection();
            }, this);

            return selected_map;
        },

        getBoundsForSelectedNodes: function(model_key) {
            console.log("getBoundsForSelectedNodes - defaulting to MODEL_NODEGROUPS, BACKGROUND_REGIONS");

            var self = this,
                model = this._getModelByID(model_key);

            var all_selected_bounds = _.chain(model.getSelectedNodeIDMap())
                .map(function(intersection, node_id) {
                    return {
                        intersection: intersection,
                        node: self._getGroupByIDDefault(model, node_id)
                    };
                })
                .reduce(function(bounds_array, value) {
                    var node = value.node,
                        intersection = value.intersection;

                    bounds_array.push(node.getIntersectionBounds(intersection));
                    return bounds_array;
                }, [])
                .value();

            return SelectedBoundsSupport.getMaximalBounds(all_selected_bounds);
        },

        getBoundsForIntersection: function(model_key, intersection) {
            console.log("getBoundsForIntersection - defaulting to MODEL_NODEGROUPS, BACKGROUND_REGIONS");

            var model = this._getModelByID(model_key);
            var group = this._getGroupByIDDefault(model, intersection["id"]);

            return group.getIntersectionBounds(intersection);
        },

        getIntersectionsByIDs: function(model_key, id_array) {
            console.log("getIntersectionsByIDs - defaulting to MODEL_NODEGROUPS, BACKGROUND_REGIONS");

            var model = this._getModelByID(model_key),
                selected_map = {};

            _.each(id_array, function(group_id) {
                var group = this._getGroupByIDDefault(model, group_id);

                selected_map[group_id] = group.getIntersection();
            }, this);
            
            return selected_map;
        },

        getLinkageBySharedID: function(model_key, shared_id) {
            var model = this._getModelByID(model_key);

            return model.getSharedItem(shared_id);
        },

        // --------
        // Edit API
        // --------
        enableNodeDrag: function(model_id, floater_node_id_list) {
            var model = this._getModelByID(model_id);

            if (floater_node_id_list === undefined || floater_node_id_list === null || ! _.isArray(floater_node_id_list)) {
                this.settings.drag_state = {
                    enable: false,
                    nodes: null,
                    translate: [0, 0]
                };

                return;
            }

            if (floater_node_id_list.length == 0) {
                return;
            }

            // Currently moving linkages is not supported, so filter out linkage nodes
            var node_id_map = _.chain(floater_node_id_list)
                .filter(function(node_id) {
                    var node = this._getGroupByID(model, node_id);
                    return node.getType() != "linkage";
                }, this)
                .reduce(function(memo, node_id) {
                    memo[node_id] = true;
                    return memo;
                }, {})
                .value();

            // Find linkages connected to the selected nodes
            var connected_linkages = {};

            _.each(this._getDrawLayerForModel(model, 'MODEL_NODEGROUPS').group_array, function(node) {
                if (node.getType() != "linkage") {
                    return;
                }

                var src = node.getSource();
                var trg = node.getTarget();

                if (_.has(node_id_map, src) || _.has(node_id_map, trg)) {
                    console.log(node["id"]);
                    connected_linkages[node["id"]] = true;
                }
            }, this);

            this.settings.drag_state = {
                enable: true,
                nodes: node_id_map,
                translate: [0, 0],
                connected_linkages: connected_linkages
            };
        },

        _getNodeMoveContext: function(model) {
            var ds = this.settings.drag_state;

            return NodeMoveContextFactory.create(model, ds.nodes, ds.enable, ds.translate, ds.connected_linkages);
        },

        setDragMove: function(x, y) {
            this.settings.drag_state.translate = [x, y];
        },

        // -------------
        // Rendering API
        // -------------
        pushContextTranslate: function(x, y) {
            this.ctx.save();
            this.ctx.translate(x, y);

            this.ovr_ctx.save();
            this.ovr_ctx.translate(x, y);

            this.temp_ctx.save();
            this.temp_ctx.translate(x, y);
        },

        popContextTransform: function() {
            this.ctx.restore();
            this.ovr_ctx.restore();
            this.temp_ctx.restore();
        },

        _getGroupByID: function(model, group_id) {
            var layer_key = "MODEL_NODEGROUPS";

            return this._getGroupByIDForLayer(model, layer_key, group_id);
        },

        renderGroupByID: function(rendering_context, model, group_id) {
            var group = this._getGroupByID(model, group_id);
            this._renderSingleGroupFN(rendering_context, group);
        },

        _getGroupByIDForLayer: function(model, draw_layer_key, group_id) {
            var layer = model.getDrawLayerByID(draw_layer_key);

            if (_.has(layer.group_id_to_index_map, group_id)) {
                var group_index = layer.group_id_to_index_map[group_id];
                return layer.group_array[group_index];
            }
            else {
                throw {
                    name: 'Unknown Group ID Error',
                    level: 'CanvasRenderer',
                    message: 'Tried to get group with unknown ID \'' + group_id + '\'',
                    htmlMessage: 'Tried to get group with unknown ID <b>' + group_id + '</b>',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }
        },

        _getGroupByIDDefault: function(model, group_id) {
            var DRAW_LAYERS = [
                "BACKGROUND_REGIONS",
                "MODEL_NODEGROUPS"
            ];

            var node =_.reduce(DRAW_LAYERS, function(found_node, draw_layer_key) {
                var layer = model.getDrawLayerByID(draw_layer_key);

                if (_.has(layer.group_id_to_index_map, group_id)) {
                    var group_index = layer.group_id_to_index_map[group_id];
                    found_node = layer.group_array[group_index];
                }

                return found_node;
            }, null);

            if (node !== null) {
                return node;
            }
            else {
                throw {
                    name: 'Unknown Group ID Error',
                    level: 'CanvasRenderer',
                    message: 'Tried to get group with unknown ID \'' + group_id + '\'',
                    htmlMessage: 'Tried to get group with unknown ID <b>' + group_id + '</b>',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }
        },

        sortNodesForMoving: function(source_node_array, static_nodes, moved_nodes) {
            if (this.settings.drag_state.enable == false) {
                Array.prototype.push.apply(static_nodes, source_node_array);
                return;
            }

            _.each(source_node_array, function(node) {
                if (_.has(this.settings.drag_state.nodes, node["id"])) {
                    moved_nodes.push(node);
                }
                else {
                    static_nodes.push(node);
                }
            }, this);
        },

        _getDrawLayerForModel: function(model, draw_layer_key) {
            return model.getDrawLayerByID(draw_layer_key);
        },

        renderAllGroupsByDrawLayer: function(rendering_context, model, draw_layer_key) {
            var current_layer = model.getDrawLayerByID(draw_layer_key);

            if (this.settings.pads.enable == false) {
                _.each(current_layer.group_array, function(group) {
                    this._renderSingleGroupFN(rendering_context, group);
                }, this);
            }
            else {
                _.each(current_layer.group_array, function(group) {
                    this._renderSingleGroupFN(rendering_context, group);

                    if (group.getType() == "gene") {
                        group.renderPads(rendering_context);
                    }
                }, this);
            }
        },

        renderSelectedGroupsByDrawLayer: function(rendering_context, model, draw_layer) {
            var current_layer = this._getDrawLayerForModel(model, draw_layer);

            _.each(current_layer.group_array, function(group) {
                var intersection = model.getIntersectionByID(group["id"]);
                if (intersection !== null) {
                    if (group.getType() == "linkage") {
                        group._renderSelectedSegmentsOnly(rendering_context, intersection);
                    }
                    else {
                        group.render(rendering_context, intersection);
                    }
                }
            }, this);
        },

        renderAllGroupsByDrawLayerWithNodeDrag: function(rc_for_static, rc_for_moved, model, draw_layer_key) {
            var current_layer = model.getDrawLayerByID(draw_layer_key);
            var static_nodes = [];
            var moved_nodes = [];

            this.sortNodesForMoving(current_layer.group_array, static_nodes, moved_nodes);

            _.each(static_nodes, function(group) {
                this._renderSingleGroupFN(rc_for_static, group);
            }, this);

            _.each(moved_nodes, function(group) {
                this._renderSingleGroupFN(rc_for_moved, group);
            }, this);
        },

        sortBackgroundRegions: function(model, toggled_array, non_toggled_array) {
            var draw_layer_key = 'BACKGROUND_REGIONS';

            _.each(model.getDrawLayerByID(draw_layer_key).group_array, function(group) {
                if (model.isEnabledGroup(group['id'])) {
                    toggled_array.push(group);
                }
                else {
                    non_toggled_array.push(group);
                }
            });
        },

        renderModelByIDFull: function(model_key) {
            var model = this._getModelByID(model_key);
            var toggled_groups = [];
            var non_toggled_groups = [];
            var rc_regions;
            var rc_model;
            var rc_move_overlay;
            var nmc = this._getNodeMoveContext(model);
            var background_region_layer = model.getDrawLayerByID('BACKGROUND_REGIONS');

            this.sortBackgroundRegions(model, toggled_groups, non_toggled_groups);

            rc_regions = RenderingContextFactory.create(model, this.ctx, background_region_layer, nmc, this._getOverlayAlphaSettings());

            _.each(non_toggled_groups, function(group) {
                group.render(rc_regions);
            });

            // Render underlay if one is enabled
            this._renderOverlayForModel(rc_model, model_key, true);

            // Render all drawlayers but overlay
            rc_model = RenderingContextFactory.create(model, this.ctx, 'UNDERLAY', nmc, this._getOverlayAlphaSettings());
            this.renderAllGroupsByDrawLayer(rc_model, model, 'UNDERLAY');

            rc_model = RenderingContextFactory.create(model, this.ctx, 'VFN_GHOSTED', nmc, this._getOverlayAlphaSettings());
            this.renderAllGroupsByDrawLayer(rc_model, model, 'VFN_GHOSTED');

            rc_model = RenderingContextFactory.create(model, this.ctx, 'MODEL_NODEGROUPS', nmc, this._getOverlayAlphaSettings());
            rc_move_overlay = RenderingContextFactory.create(model, this.temp_ctx, 'MODEL_NODEGROUPS', nmc, this._getOverlayAlphaSettings());

            this._clearContextParam(this.temp_ctx);
            this.renderAllGroupsByDrawLayerWithNodeDrag(rc_model, rc_move_overlay, model, 'MODEL_NODEGROUPS');

            _.each(toggled_groups, function(group) {
                group.render(rc_regions);
            }, this);

            if (this.settings.drag_state.enable) {
                this._renderFloater();
            }

            this.renderAllGroupsByDrawLayer(rc_regions, model, ['VFN_UNUSED_REGIONS']);

            this._renderOverlayForModel(rc_model, model_key, false);

            this.renderAllGroupsByDrawLayer(rc_regions, model, ['MODELDATA']);
        },

        _renderFloater: function() {
            this.ctx.save();

            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            if (this.settings.drag_state.translate !== null) {
                this.ctx.translate.apply(this.ctx, this.settings.drag_state.translate);
            }
            this.ctx.globalAlpha = 0.5;
            this.ctx.drawImage(this.config.temp_canvas.element, 0, 0);
            this.ctx.globalAlpha = 1.0;
            this.ctx.restore();
        },

        getOverlay: function(model_key, overlay_id) {
            var model = this._getModelByID(model_key);

            return model.getOverlay(overlay_id);
        },

        _getOverlayForModel: function(model, overlay_id) {
            return model.getOverlay(overlay_id);
        },

        _renderOverlayForModel: function(rendering_context, model_key, do_underlay) {
            var overlay_id = this.settings.overlay.id,
                overlay,
                model = this._getModelByID(model_key);

            if (overlay_id === null) {
                return;
            }

            overlay = model.getOverlay(overlay_id);

            if (do_underlay == true) {
                this.overlaySupport.underlayRenderIfEnabled(model, overlay, this._getOverlayAlphaSettings());
            }
            else {
                this.overlaySupport.overlayRender(model, overlay, this._getOverlayAlphaSettings());
            }
        },

        toggleOverlay: function(overlay_config) {
            if (overlay_config === null) {
                return;
            }

            // TODO
            // add validation of overlay_config
            if (overlay_config.id == null) {
                this.settings.overlay = {
                    "id": null
                }
            }
            else {
                this.settings.overlay = overlay_config;

                if (!_.has(overlay_config, "enabled_modules")) {
                    this.settings.overlay.enabled_modules = [];
                }
            }
        },

        toggleGroupForModelID: function(model_key, toggled_region_id_array) {
            var model = this._getModelByID(model_key),
                enabled_groups = {};

            _.each(toggled_region_id_array, function(region_id) {
                enabled_groups[region_id] = true;
            });

            model.setEnabledGroups(enabled_groups);
        },

        setOverlayIntensity: function(intensity) {
            if (0.0 <= intensity <= 1.0) {
                NetModuleAlphaBuilder.alphaCalc(100.0 * intensity, this._getOverlayAlphaSettings());
            }
            else {
                throw {
                    name: 'Invalid Overlay Alpha Error',
                    level: 'CanvasRenderer',
                    message: 'Invalid alpha value ' + intensity + ', must be between 0.0 and 1.0',
                    htmlMessage: 'Invalid alpha value <b>' + intensity + '</b>, must be between 0.0 and 1.0',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }
        },

        _getOverlayAlphaSettings: function() {
            return this.settings.overlay_alpha;
        },

        switchBoundsDebug: function() {
            if (this.config.bounds_debug === false) {
                this.config.bounds_debug = true;
            }
            else {
                this.config.bounds_debug = false;
            }

            this._setSingleGroupRenderHandler();
        },

        setViewportTranslation: function(viewport) {
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ovr_ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.temp_ctx.setTransform(1, 0, 0, 1, 0, 0);

            this.viewport = viewport;

            this.ctx.translate(this.viewport.x, this.viewport.y);
            this.ovr_ctx.translate(this.viewport.x, this.viewport.y);
            this.temp_ctx.translate(this.viewport.x, this.viewport.y);
        },

        _clearContextParam: function(ctx) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this.config.viewport_dims.width, this.config.viewport_dims.height);
            ctx.restore();
        },

        clearContext: function() {
            this.ctx.save();
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.clearRect(0, 0, this.config.viewport_dims.width, this.config.viewport_dims.height);
            this.ctx.restore();
        },

        _translateHit: function(hit) {
            var translatedHit = {
                x: hit.x,
                y: hit.y
            };

            // convert to canvas coordinates
            translatedHit.x -= this.viewport.x;
            translatedHit.y -= this.viewport.y;

            return translatedHit;
        },

        // -----------------------
        // Graphical selection API
        // -----------------------
        _doRectangleSelectionFromCanvas: function(canvas_rect, model_key) {
            var point1 = this._translateHit({
                x: canvas_rect.x1,
                y: canvas_rect.y1
            });

            var point2 = this._translateHit({
                x: canvas_rect.x2,
                y: canvas_rect.y2
            });

            return this._doRectangleSelection({
                min_x: _.min([point1.x, point2.x]),
                min_y: _.min([point1.y, point2.y]),
                max_x: _.max([point1.x, point2.x]),
                max_y: _.max([point1.y, point2.y])
            }, model_key);
        },

        _doRectangleSelection: function(selection_rect, model_key) {
            var model = this._getModelByID(model_key);

            return this.rectangle_selection_support.doRectangleSelection(
                selection_rect,
                model,
                this.settings.overlay,
                this._getOverlayAlphaSettings());
        },

        _doPointSelectionFromCanvas: function(canvas_point, model_key) {
            var point = this._translateHit(canvas_point);

            return this._doPointSelection(point, model_key);
        },

        _doPointSelection: function(point, model_key) {
            var model = this._getModelByID(model_key);
            var rc_for_module_masks = RenderingContextFactory.create(model, this.temp_ctx, {});

            return this.intersections._pointIntersectModel(
                point,
                model,
                this.settings.overlay,
                this._getOverlayAlphaSettings(),

                // TODO remove from here and from function definition
                rc_for_module_masks);
        },

        ///////////////////////////////
        // Dragging, Linkage drawing //
        ///////////////////////////////
        togglePadRendering: function(flag) {
            this.settings.pads.enable = (flag == true);
        }
    };

    return BioTapestryCanvasRendererFactory = {
        create: function(config) {
            var obj = Object.create(BioTapestryCanvasRendererPrototype, {});
            var overlayAlphaSettings = {};

            obj.config = {
                bounds_debug: false,
                primary_canvas: config.primary_canvas,
                overlay_canvas: config.overlay_canvas,
                temp_canvas: config.temp_canvas,
                viewport_dims: config.viewport
            };

            NetModuleAlphaBuilder.alphaCalc(100.0, overlayAlphaSettings);

            obj.settings = {
                overlay: {
                    id: null
                },
                overlay_alpha: overlayAlphaSettings,
                pads: {
                    enable: false
                },
                drag_state: {
                    enable: false,
                    nodes: [],
                    translate: null
                }
            };

            obj.group_array = [];
            obj.group_id_to_index_map = { };

            obj.selected_nodes_map = { };

            obj.initialize();

            obj.intersections = HitBoxSearchFactory.create({
                renderer: obj
            });

            obj.rectangle_selection_support = RectangleSelectionSupportFactory.create({
                renderer: obj
            });

            obj.overlaySupport = OverlayRenderFunctions.create(obj);

            var font_canvas = document.createElement('canvas');
            font_canvas.width = 512;
            font_canvas.height = 64;
            obj.font_metrics_ctx = font_canvas.getContext('2d');

            return obj;
        }
    };

// end define
});
