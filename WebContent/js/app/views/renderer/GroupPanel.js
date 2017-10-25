/*
 **    Copyright (C) 2003-2016 Institute for Systems Biology
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
    './nodes/Color',
    './util/DocumentUtils'
],
function(
    ColorFactory,
    DocumentUtils
) {
    var RENDER_MODES = {
        MODE_IMAGE: 0,
        MODE_MASKED: 1
    };

    var GROUP_NODE_TYPE = "GROUP_NODE";

    var GroupPanelPrototype = {
        ///////////////////////////////////
        // GroupPanel
        ///////////////////////////////////
        //
        // Module for rendering group node bitmap images.
        //
        // Returns model and proxy identifiers from a click map image
        // given click coordinates.
        //
        // The group node image URLs, for both the rendered image and
        // the click map, are provided as parameters to the factory method
        // in the configuration object.
        //
        ////////////////////////////////


        ////////////////////////////////
        // initialize
        ////////////////////////////////
        //
        // Initializes the object.
        //
        initialize: function (click_map_array, color_bounds_array) {
            this.images_loaded = false;
            this.ctx = null;
            this.render_mode = RENDER_MODES.MODE_IMAGE;

            this.constants = {
                MASK_ALPHA: 0.5
            };

            var image_img = new Image();
            var image_mask = new Image();

            this.images = {
                image: image_img,
                mask: image_mask
            };

            this._initializeClickMap(click_map_array);
            this._initializeColorBounds(color_bounds_array);
        },

        ////////////////////////////////
        // imagesLoaded
        ////////////////////////////////
        //
        // Handler function to be called after both images have been loaded.
        // Stores the click map image size and creates a canvas and rendering context
        // for the click map image. Calls the provided function.
        //
        imagesLoaded: function (loadSuccessHandler) {
            this.images_loaded = true;
            this._initializeMaskCanvases();

            loadSuccessHandler();
        },

        ////////////////////////////////
        // _initializeMaskCanvases
        ////////////////////////////////
        //
        // Initializes two internal (not visible) Canvas objects, and sets references two both canvases
        // and contexts:
        //
        // 1. Canvas ("mask_canvas") and context ("mask_ctx") for the mask image. The context
        //    is used for getting the R,G,B values of individual pixels in the mask, which are used for
        //    lookup values in the click map.
        // 2. Canvas ("filtered_canvas") and context ("filtered_ctx") for storing a filtered mask image.
        //    The image data of the canvas is set when enableMaskRenderingWithPoint is called, and is
        //    used in the masked rendering mode.
        //
        _initializeMaskCanvases: function() {
            var mask_width = this.images.mask.width;
            var mask_height = this.images.mask.height;

            console.debug("GroupNode clickmap image is " + mask_width + "x" + mask_height + " pixels");

            // Create canvas for click-map image mask
            this.mask_canvas = DocumentUtils.createCanvasElement(mask_width, mask_height);
            this.mask_ctx = this.mask_canvas.getContext('2d');
            this.mask_ctx.drawImage(this.images.mask, 0, 0);

            // Create canvas for filtered mask image
            this.filtered_canvas = DocumentUtils.createCanvasElement(mask_width, mask_height);
            this.filtered_ctx = this.filtered_canvas.getContext('2d');

            // It is assumed that "filtered_canvas" is only used as a target for the filtered ImageData of the
            // mask image. Therefore, the fillStyle for the context is pre-set here, for the clearRect call
            // in enableMaskRenderingWithPoint.
            this.filtered_ctx.fillStyle = "#000000";
        },

        ////////////////////////////////
        // _initializeColorBounds
        ////////////////////////////////
        //
        // Prepares the internal storage of the mask image color bounds.
        //
        // Parameters:
        // :exported_color_bounds:
        // An array of objects, each defining the minimal bounding rectangle in which a color
        // is present in the mask image. Object format example:
        //
        // {
        //   "bounds_":
        //     {"y": 244,  "h": 25,  "w": 82,  "x": 413 },
        //   "color_":
        //     [  32,  166,  222,  255 ]
        // }
        //
        _initializeColorBounds: function(exported_color_bounds) {
            var color_bounds = [];
            var i, item, exported_rgb_array, exported_bounds;

            for (i = 0; i < exported_color_bounds.length; i++) {
                item = exported_color_bounds[i];
                exported_rgb_array = item['color_'];
                exported_bounds = item['bounds_'];

                color_bounds.push({
                    'color': ColorFactory.buildFromArrayRGB(exported_rgb_array),
                    'bounds': exported_bounds
                });
            }

            this.color_bounds = color_bounds;
        },

        ////////////////////////////////
        // _initializeClickMap
        ////////////////////////////////
        //
        // Prepares the internal storage of the mask image click map.
        //
        // Parameters:
        // :exported_click_map:
        // An array of objects, each mapping one color (R,G,B triplet) to a model identifier.
        // The object must contain one or more of the fields 'nodeID', 'regionID', 'proxyID' and
        // 'proxyTime'.
        //
        // Object format example:
        //
        // {
        //   "proxyTime":15,
        //   "proxyID":"emvfo",
        //   "g": 159, "b": 204, "r": 50
        // }
        //
        _initializeClickMap: function(exported_click_map) {
            var click_map = [];
            var i, item;

            for (i = 0; i < exported_click_map.length; i++) {
                item = exported_click_map[i];

                click_map.push({
                    'color': ColorFactory.build(item['r'], item['g'], item['b']),
                    'node': {
                        'node_id': item['nodeID'] || null,
                        'proxy_id': item['proxyID'] || null,
                        'proxy_time': item['proxyTime'] || null,
                        'region_id': item['regionID'] || null
                    }
                });
            }

            this.click_map = click_map;

        },

        ////////////////////////////////
        // _getMaskBoundsForColor
        ////////////////////////////////
        //
        // Returns the minimal rectangle that encloses the area in which a the given
        // color is present in the mask image.
        //
        // This function does not resolve the bounding rectangle from the content of mask image,
        // but instead relies on that information being available from the server-side
        // application. See also _initializeColorBounds.
        //
        // Returns null if the bounding rectangle is not available for the given color.
        //
        _getMaskBoundsForColor: function(color) {
            var bounds_array_color_key;
            var found = _.findIndex(this.color_bounds, function(bounds_item) {
                bounds_array_color_key = bounds_item.color;
                return color.equals(bounds_array_color_key);
            });

            if (found != -1) {
                return this.color_bounds[found]['bounds'];
            }
            else {
                return null;
            }
        },

        ////////////////////////////////
        // _filterImageDataColorReplace
        ////////////////////////////////
        //
        // Filters all pixels of a Canvas ImageData object, such that every pixel
        // matching the color parameter will become fully transparent, and the
        // non-matching pixels will become fully opaque.
        //
        // Parameters:
        //
        // imd: ImageData object
        // color: Object with keys 'r', 'g', 'b'
        //
        _filterImageDataColorReplace: function(imd, color) {
            var i, size, r, g, b, trg;

            for (i = 0, size = imd.width * imd.height; i < size; i += 1) {
                r = imd.data[i * 4];
                g = imd.data[i * 4 + 1];
                b = imd.data[i * 4 + 2];

                if (r == color.r && g == color.g && b == color.b) {
                    // Set the mask fully transparent and keep underlying color
                    // 0xFFFFFFFF
                    trg = {r: 255, g: 255, b: 255, a: 255};
                }
                else {
                    // 0x00000000
                    trg = {r: 0, g: 0, b: 0, a: 0};
                }

                imd.data[i * 4] = trg.r;
                imd.data[i * 4 + 1] = trg.g;
                imd.data[i * 4 + 2] = trg.b;
                imd.data[i * 4 + 3] = trg.a;
            }
        },

        ////////////////////////////////
        // enableMaskRenderingWithPoint
        ////////////////////////////////
        //
        // Enables rendering with region highlighting. Any pixel location in the mask
        // image matching the color of the specified point will be highlighted in the rendered image.
        //
        // The x, y coordinates of the point are relative to the unscaled
        // image. Behavior is unspecified if the coordinates are outside the unscaled
        // image.
        //
        // The highlighting is done by adding (source-over) white to the group node image,
        // with default alpha value of 0.5. The alpha value can be set by overwriting the
        // "constants.MASK_ALPHA" variable of an instance of this class.
        //
        // After this function is called, neither _getNodeIdFromMaskColor and
        // _getMaskPixelValue can be called - both will return undefined values.
        // This happens because this function overwrites the mask canvas with a filtered
        // mask image. To use the above functions, disableMaskRendering has to be
        // called first.
        //
        enableMaskRenderingWithPoint: function(point) {
            this.render_mode = RENDER_MODES.MODE_MASKED;
            var color = this._getMaskPixelValue(point.x, point.y);

            // TODO comment
            var mask_bounds = this._getMaskBoundsForColor(color);

            var mask_imd;

            if (mask_bounds !== null) {
                this.filtered_ctx.clearRect(0, 0, this.images.mask.width, this.images.mask.height);

                mask_imd = this.mask_ctx.getImageData(
                    mask_bounds.x,
                    mask_bounds.y,
                    mask_bounds.w,
                    mask_bounds.h);

                this._filterImageDataColorReplace(mask_imd, color);
                this.filtered_ctx.putImageData(mask_imd, mask_bounds.x, mask_bounds.y);
            }
            else {
                mask_imd = this.mask_ctx.getImageData(0, 0, this.images.mask.width, this.images.mask.height);
                this._filterImageDataColorReplace(mask_imd, color);
                this.filtered_ctx.putImageData(mask_imd, 0, 0);
            }

        },

        ////////////////////////////////
        // disableMaskRendering
        ////////////////////////////////
        //
        // Disables rendering with region highlighting.
        //
        disableMaskRendering: function() {
            this.render_mode = RENDER_MODES.MODE_IMAGE;
        },

        ////////////////////////////////
        // setContext
        ////////////////////////////////
        //
        // Sets the rendering context. Has to be called
        // before any calls to render or loadImagesAndRender.
        //
        setContext: function(new_context) {
            this.ctx = new_context;
        },

        ////////////////////////////////
        // getContext
        ////////////////////////////////
        //
        // Returns the rendering contexts.
        //
        getContext: function() {
            if (this.ctx === null) {
                throw {
                    name: 'CanvasContext2D Not Set Error',
                    level: 'GroupPanel.getContext',
                    message: 'Rendering context is not set',
                    htmlMessage: 'Rendering context is not set',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }

            return this.ctx;
        },

        ////////////////////////////
        // _renderWithMask
        ////////////////////////////////
        //
        // Used internally by render().
        //
        // Renders the group node image, highlighted with the white transparent pixels
        // of the mask image.
        //
        _renderWithMask: function(width, height) {
            var ctx = this.getContext();
            ctx.drawImage(this.images.image, 0, 0, width, height);
            ctx.globalAlpha = this.constants.MASK_ALPHA;
            ctx.globalCompositeOperation = "source_over";
            ctx.drawImage(this.filtered_canvas, 0, 0, width, height);
            ctx.globalAlpha = 1.0;
        },

        ////////////////////////////
        // render
        ////////////////////////////////
        //
        // Renders the group node image to the set context.
        // If 'scaling_factor' number is given, scale the image using this factor
        // for rendering. Otherwise, scale defaults to 1.0.
        //
        // If the images have not been loaded, this function does nothing.
        //
        // Throws exception if rendering context is not set using the setContext
        // function.
        //
        render: function(scaling_factor) {
            var width = this.images.image.width;
            var height = this.images.image.height;
            var apply_scaling = false;

            if (this.images_loaded === false) {
                return;
            }

            if (typeof(scaling_factor) === 'number') {
                apply_scaling = true;
                width = Math.floor(scaling_factor * width);
                height = Math.floor(scaling_factor * height);
            }

            var ctx = this.getContext();

            if (apply_scaling == false && this.render_mode == RENDER_MODES.MODE_IMAGE) {
                ctx.drawImage(this.images.image, 0, 0);
            }
            else if (apply_scaling == true && this.render_mode == RENDER_MODES.MODE_IMAGE) {
                ctx.drawImage(this.images.image, 0, 0, width, height);
            }
            else if (apply_scaling == false && this.render_mode == RENDER_MODES.MODE_MASKED) {
                this._renderWithMask(width, height);
            }
            else if (apply_scaling == true && this.render_mode == RENDER_MODES.MODE_MASKED) {
                this._renderWithMask(width, height);
            }
        },

        ////////////////////////////////
        // loadImagesAndRender
        ////////////////////////////////
        //
        // Initiates asynchronous load for the two images
        // (rendered and click map), and calls render after
        // the image loads finish.
        //
        loadImagesAndRender: function(scaling_factor) {
            if (this.images_loaded === false) {
                this.loadImages(_.bind(this.render, this, scaling_factor));
            } else {
            	this.render(scaling_factor);
            }
        },

        ////////////////////////////////
        // _getMaskPixelValue
        ////////////////////////////////
        //
        // Return the r,g,b value triplet in the click map image for
        // the given x,y coordinate.
        //
        // The x, y coordinates are relative to the unscaled
        // image. Behavior is unspecified if the coordinates are outside the unscaled
        // image.
        //
        _getMaskPixelValue: function(x, y) {
            var image_data = this.mask_ctx.getImageData(x, y, 1, 1);

            // Since the ImageData object is only one pixel in size and
            // contains the R,G,B,A in that order, it can be used as input for
            // the Color factory method.
            return ColorFactory.buildFromArrayRGB(image_data.data);
        },

        ////////////////////////////////
        // loadImages
        ////////////////////////////////
        //
        // Initiates loads for both images. Call loadSuccessFn
        // after both loads complete.
        //
        loadImages: function(loadSuccessFn) {
            var synchronizer = _.after(2, _.bind(this.imagesLoaded, this));

            this.images.mask.onload = function () {
                synchronizer(loadSuccessFn);
            };
            this.images.mask.src = this.config.mask_uri;

            this.images.image.onload = function() {
                synchronizer(loadSuccessFn);
            };
            this.images.image.src = this.config.image_uri;
        },

        ////////////////////////////////
        // _getNodeIdFromMaskColor
        ////////////////////////////////
        //
        // Returns an object containing node_id and proxy_id that matches
        // to the given color. If the color does not match any entries,
        // the return value is null.
        //
        _getNodeIdFromMaskColor: function (color) {
            var map_color_key;
            var found = _.findIndex(this.click_map, function(item) {
                map_color_key = item.color;
                return color.equals(map_color_key);
            });

            if (found == -1) {
                return null;
            }
            else {
                return this.click_map[found]['node'];
            }
        },

        ////////////////////////////////
        // getNodeIdForPoint
        ////////////////////////////////
        //
        // Return the model and proxy identifier for a give x, y coordinate
        // of the click map image. If no model and proxy identifier is mapped to
        // the given coordinate, the return value is null.
        //
        // The x, y coordinates are relative to the unscaled
        // image. Behavior is unspecified if the coordinates are outside the unscaled
        // image.
        //
        getNodeIdForPoint: function (x, y) {
            var mask_color = this._getMaskPixelValue(x, y);
            return this._getNodeIdFromMaskColor(mask_color, this.config.click_map);
        },

        ////////////////////////////////
        // getType
        ////////////////////////////////
        //
        // Returns type of this object.
        // See also: Model.getType
        //
        getType: function() {
            return GROUP_NODE_TYPE;
        }
    };

    return {
        ////////////////////////////////
        // create
        ////////////////////////////////
        //
        // Factory method that builds a GroupPanel instance.
        //
        // Parameters:
        // :click_map:
        //
        // An array of objects mapping a color present in the mask image to a nodeID, regionID,
        // proxyID and proxyTime. Each object in the array has to contain fields 'r', 'g' and 'b' to
        // represent the color as an R,B,G triplet, and the fields 'nodeID', 'regionID', 'proxyID'
        // and 'proxyTime'.
        //
        // :node_image_uri: The URI that returns the node image using HTTP GET.
        // :mask_image_uri: The URI that returns the mask image using HTTP GET.
        //
        // :color_bounds_array: See _initializeColorBounds.
        //
        create: function(click_map_array, node_image_uri, mask_image_uri, color_bounds_array) {
            var obj = Object.create(GroupPanelPrototype, {});
            obj.config = {
                image_uri: node_image_uri,
                mask_uri: mask_image_uri
            };

            obj.initialize(click_map_array, color_bounds_array);

            return obj;
        }
    };
});
