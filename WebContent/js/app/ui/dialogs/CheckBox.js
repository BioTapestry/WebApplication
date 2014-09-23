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
    "dojo/dom",
    "dojo/dom-construct",
	"dojo/_base/declare",
	"dijit/form/CheckBox",
	"dijit/Destroyable",
	"dojo/Evented",
	"dojo/Stateful",
	"app/utils"
],function(
	dom,
	domConstruct,
	declare,
	CheckBox,
	Destroyable,
	Evented,
	Stateful,
	utils
) {
	
	///////////////////////
	// BTCheckBox
	//////////////////////
	//
	// A wrapper for dijit/form/CheckBox which is Evented, Stateful, Destroyable,
	// and has the ability to place itself on the DOM and manage a label

	return declare([Destroyable,Evented,Stateful],{
		
		disabled: null,
		_disabledSetter: function(val) {
			this.thisCheck_.set("disabled",val);
		},
		_disabledGetter: function() {
			return this.thisCheck_.get("disabled");
		},
					
		label: null,
		
		isChecked: null,
		
		labelPlacement: null,
		
		name: null,
		
		id: null,
		
		domNode: null,
		
		thisCheck_: null,
		
		destroyRecursive: function() {
			this.destroy();
		},
		
		_placeCheckBoxLabel: function() {
				
			domConstruct.create(
				"label",
				{ 
					innerHTML: this.label,
					"class":"BTCheckBoxLabel",
					"for": this.id
				},
				this.domNode,
				(this.labelPlacement ? this.labelPlacement : "after")
			);			
		},
		
		placeMe: function(placeAt,placement) {
			
			var self=this;
			
			var checkContainer = domConstruct.create("p",{id: this.id + "_container", "class":"BTCheckBoxContainer"},placeAt,"last");
						
			this.own(
				this.thisCheck_.on("change",function() {
					self.emit("change",{bubbles: true, cancelable: true, newVal: self.thisCheck_.value});
				})
			);
			
			this.thisCheck_.placeAt(checkContainer);
			
			this.domNode = this.thisCheck_.domNode;
						
			this._placeCheckBoxLabel();
		},
				
		constructor: function(params) {
			declare.safeMixin(this,params);
			
			this.thisCheck_ = new CheckBox({
				id: this.id,
				checked: this.isChecked,
				name: this.name,
				value: this.value,
				"class":"BTCheckBox"
			});
		}
	});
});