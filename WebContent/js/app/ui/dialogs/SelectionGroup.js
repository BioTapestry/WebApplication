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
	"dojo/_base/array",
	"dijit/form/RadioButton",
	"dijit/Destroyable",
	"dojo/Evented",
	"app/utils"
],function(
	dom,
	domConstruct,
	declare,
	DojoArray,
	RadioButton,
	Destroyable,
	Evented,
	utils
) {
	
	/////////////////////////////
	// SelectionGroup
	////////////////////////////
	//
	// SelectionGroup module which will place N number of radio buttons with labels into a DIV container 
	// with a span-label of its own. The RadioButtons are be dijit/form/RadioButton widgets


	return declare([Destroyable,Evented],{
		
		radioButtons_: null,
				
		label: null,
		
		name: null,
		
		id: null,
		
		domNode: null,
		
		destroyRecursive: function() {
			var self=this;
			DojoArray.forEach(Object.keys(this.radioButtons_),function(btn){
				self.radioButtons_[btn].destroyRecursive();
			});
			radioButtons_ = null;
			domNode = null;
			this.destroy();
		},
		
		_placeSelexGrpLabel: function() {
			domConstruct.create(
				"span",
				{ 
					innerHTML: this.label,
					"class":"SelGroupLabel"
				},
				this.domNode,
				"first"
			);			
		},
		
		addButton: function(thisButton,id) {
			if(!id) {
				id = thisButton.id + "_" + utils.makeId();
			}
			if(this.radioButtons_[id]) {
				this.radioButtons_[id].destroyRecursive();
			}
			this.radioButtons_[id] = thisButton;
		},
		
		makeNewButton: function(params,id) {
			var self=this;
			if(!id) {
				id = params.id + "_" + utils.makeId();
			}
			if(this.radioButtons_[id]) {
				this.radioButtons_[id].destroyRecursive();
			}
			this.radioButtons_[id] = new RadioButton(params);
			var thisButton = this.radioButtons_[id];
			this.own(
				thisButton.on("change",function(newVal) {
					if(newVal) {
						self.emit("change",{bubbles: true, cancelable: true, newVal: thisButton.value, values: self.getValues()});
					}
				})
			);
		},
		
		getButton: function(id) {
			if(this.radioButtons_) {
				return this.radioButtons_[id];
			}
			return null;
		},
		
		getValues: function() {
			var values;
			for(var i in this.radioButtons_) {
				if(this.radioButtons_.hasOwnProperty(i)) {
					if(!values) {
						values = {};
					}
					values[this.radioButtons_[i].value] = this.radioButtons_[i].checked; 
				}
			}
			return values;
		},
		
		placeMe: function(placeAt,placement) {
			if(!this.domNode) {
				this.domNode = domConstruct.create(
					"div",
					{ 
						id: "selexGrpContainer_" + this.id + "_" + utils.makeId(),
						style: (this.style ? this.style : null),
						"class": (this.style ? null : "SelGroupContainer")
					},
					placeAt,
					placement
				);
			}
			
			this._placeSelexGrpLabel();
			
			for(var i in this.radioButtons_) {
				if(this.radioButtons_.hasOwnProperty(i)) {
					domConstruct.create("p",{id: this.radioButtons_[i].value + "_cont", "class":"SelGroupRadioContainer"},this.domNode.id,"last");
					domConstruct.place(this.radioButtons_[i].domNode,this.radioButtons_[i].value + "_cont","last");
					domConstruct.place(
						domConstruct.create("label",{
							innerHTML: this.radioButtons_[i].label,
							"for": this.radioButtons_[i].id,
							"class":"SelGroupRadioLabel"
						}),
						this.radioButtons_[i].domNode,
						"after"
					);	
				}
			}
		},
		
		buildValues: function(availableValues,valueOrder) {
			var self=this;
			
			if(!this.radioButtons_) {
				this.radioButtons_ = {};
			}
			
			if(valueOrder) {
				DojoArray.forEach(valueOrder,function(value){
					var myId = value + "_" + utils.makeId();
					var params = {id: myId,name: self.name, value: value, label: availableValues[value]};
					if(self.selValue === value) {
						params.checked = true;
					}
					self.makeNewButton(params,myId);
				});
			} else {
				for(var i in availableValues) {
					if(availableValues.hasOwnProperty(i)) {
						var myId = i + "_" + utils.makeId();
						var params = {id: myId,name: self.name, value: i, label: availableValues[i]};
						if(this.selValue === i) {
							params.checked = true;
						}
						this.makeNewButton(params,myId);
					}
				}
			}
		},
		
		formatValues: function() {
			
		},
		
		constructor: function(params) {
			declare.safeMixin(this,params);
		}
	});
});