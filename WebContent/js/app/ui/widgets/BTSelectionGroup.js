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
	"dijit/layout/ContentPane",
	"./BTRadioButton",
	"app/utils"
],function(
	dom,
	domConstruct,
	declare,
	DojoArray,
	ContentPane,
	RadioButton,
	utils
) {
	
	/////////////////////////////
	// BTSelectionGroup
	////////////////////////////
	//
	// SelectionGroup module which will place N number of radio buttons with labels into a ContentPane 
	// with a span-label of its own. The ContentPane emits a "change" event when the selected button
	// swaps.
	//
	// TODO: Allow checkbox skin; allow multi-select
	//
	return declare([ContentPane],{
		
		// Map of references to our buttons so they can be easily
		// accessed by their IDs
		radioButtons_: null,
		
		// Mapping of the value to the RadioButton widget representing it
		buttonChoices_: null,
				
		// does this SelectionGroup have a label
		label: null,
		
		// The domNode of the label
		labelNode: null,
		
		// name attribute which will be shared among mutually exclusive values of
		// the SelectionGroup
		name: null,
					
		//////////////////
		// makeNewButton
		//////////////////
		//
		// Make a SelectionGroup button, hook up its onChange to the SelectionGroup's emit
		// event, and set down the button's label
		//
		makeNewButton: function(params,id) {
			var self=this;
			if(!id) {
				id = params.id + "_" + utils.makeId();
			}
			if(this.radioButtons_ && this.radioButtons_[id]) {
				this.buttonChoices_ && delete this.buttonChoices_[this.radioButtons_[id].value];
				this.removeChild(this.radioButtons_[id]);
				this.radioButtons_[id].destroyRecursive();
			}
						
			params.isForSelGroup = true;
			
			this.radioButtons_[id] = new RadioButton(params);
			var thisButton = this.radioButtons_[id];
			
			this.addChild(thisButton);
			
			this.buttonChoices_[params.value] = this.radioButtons_[id];
			
			this.own(
				thisButton.on("change",function(newVal) {
					if(newVal) {
						self.emit("change",{bubbles: true, cancelable: true, newVal: thisButton.value, values: self.getValues()});
					}
				})
			);
		},
		
		//////////////
		// getButton
		/////////////
		//
		// Fetch out a specific button given its widget ID
		//
		getButton: function(id) {
			if(this.radioButtons_) {
				return this.radioButtons_[id];
			}
			return null;
		},
				
		removeChild: function(thisBtn) {
			if(this.radioButtons_ && this.radioButtons_[thisBtn.id]) {
				this.buttonChoices_ && delete this.buttonChoices_[thisBtn.value];
				delete this.radioButtons_[thisBtn.id];
			}
			
			this.inherited(arguments);
			
			thisBtn && thisBtn.remove && thisBtn.remove();
		},
		
		////////////////////
		// removeChoices
		///////////////////
		//
		//
		removeChoices: function(toRemove) {
			var self=this;
			DojoArray.forEach(toRemove,function(choice){
				if(self.buttonChoices_ && self.buttonChoices_[choice]) {
					self.removeChild(self.buttonChoices_[choice]);
				}
			});
		},
		
		//////////////
		// getValues
		//////////////
		//
		// Return all currently selected values of the radio button set
		// 
		getValues: function() {
			var values = null;
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
		
		// Override
		////////////////
		// postCreate
		///////////////
		//
		// Perform button creation once the ContentPane is ready
		//
		postCreate: function() {
			this.makeButtons();			
		},
		
		// Override
		//////////////////
		// placeAt
		/////////////////
		//
		// Any time placeAt is called, set down the label
		//
		placeAt: function() {
			this.inherited(arguments);
			this._placeLabel();
		},
		
		//////////////////
		// _placeLabel
		//////////////////
		//
		// Method for placing a label for the SelectionGroup's ContentPane; this
		// is the first child of the ContentPane's domNode
		//
		_placeLabel: function() {
			
			if(this.label) {
				// If the selection group is being moved, we need to remove the old label 
				// and make a new one at the new location
				if(this.labelNode) {
					domConstruct.destroy(this.labelNode.id);
					this.labelNode = null;
				}
					
				this.labelNode = domConstruct.create(
					"p",
					{ 
						innerHTML: this.label,
						"class":"BTSelGroupLabel",
						id: this.id+"_label"
					},
					this.domNode,
					"first"
				);	
			}
		},
				
		////////////////
		// makeButtons
		////////////////
		//
		// Based on the availableValues, build out the radio buttons and their labels
		//
		makeButtons: function() {
			var self=this;
			
			if(!this.radioButtons_) {
				this.radioButtons_ = {};
			}
			
			if(!this.buttonChoices_) {
				this.buttonChoices_ = {};
			}
			
			if(this._params.valueOrder) {
				DojoArray.forEach(this._params.valueOrder,function(value){
					var myId = value + "_" + utils.makeId();
					var params = {id: myId,name: self.name, value: value, label: self._params.availableValues[value]};
					if(self.selValue === value) {
						params.checked = true;
					}
					self.makeNewButton(params,myId);
				});
			} else {
				for(var i in this._params.availableValues) {
					if(this._params.availableValues.hasOwnProperty(i)) {
						var myId = i + "_" + utils.makeId();
						var params = {id: myId,name: self.name, value: i, label: this._params.availableValues[i]};
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
			this._params = params;
			
			if(params["class"]) {
				params["class"] += " ";
			} else {
				params["class"] = "";
			}
			params["class"] += "BTSelGroup" + (params.justified ? " Justified" : "");
			
			this.inherited(arguments);
		}
	});
});