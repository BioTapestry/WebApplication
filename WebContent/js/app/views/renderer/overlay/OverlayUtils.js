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

], function (

) {
    return {
        fillContextParam: function(context, fillColor) {
            context.save();
            context.setTransform(1, 0, 0, 1, 0, 0);

            context.fillStyle = fillColor;
            context.fillRect(0, 0, this.config.viewport_dims.width, this.config.viewport_dims.height);
            //context.fillColor = "rgb(255,0,0)";
            //context.fillRect(0, 0, 50, 50);
            context.restore();
        },

        copyImageDataColorChannel: function(src_image_data, dst_image_data, source_channel, dest_channel) {
            var src_pixel_data = src_image_data.data,
                dst_pixel_data = dst_image_data.data,
                src_length = src_pixel_data.length;

            if (src_length != dst_pixel_data.length) {
                console.error("Source image data array length does not equal that of destination.");
                return;
            }

            for(var i = 0; i < src_length; i += 4) {
                dst_pixel_data[i + dest_channel] = src_pixel_data[i + source_channel];
            }
        }
    }
});
