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
    "dojo/_base/declare",
    "dojo/dom",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/_base/fx"
],function(
	declare,
	dom,
	domStyle,
	domConstruct,
	fx
){
	
	return declare([],{
		overlayNode: null,
		constructor: function(overlayId) {
			// save a reference to the overlay
	        this.overlayNode = dom.byId(overlayId);
		},
	    // called to hide the loading overlay
	    endLoading:function(){
	    	fx.fadeOut({
	    		node: this.overlayNode,
	            onEnd: function(node){
	            	domStyle.set(node, 'display', 'none');
	            }
            }).play();
	    	domConstruct.destroy("baseLoadDisplay");
        }			
	});
});