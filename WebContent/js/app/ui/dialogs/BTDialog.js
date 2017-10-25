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


////////////////////////////////
// BTDialog
////////////////////////////////
//
// Extension of dijit/Dialog to add some additional functionality, such as 
// registering a callback on close/open, etc.


define([
	"dojo/_base/declare",
    "dojo/dom-style",
    "dojo/_base/array",
    "dojo/aspect",
    "dijit/Dialog",
    "dojo/Deferred"
],function(
	declare,
	domStyle,
	DojoArray,
	aspect,
	Dialog,
	Deferred
) {		
	
	
	return declare([Dialog],{
			
		postHideDone_: null,
		
		defaultConditionStates: null,
		
		definition: null,
		
		userInputs: null,
		
		bundleMap: null,
		
		actionId: null,
		
		offset: null,
				
		forImmediateDestruction: null,
		
		exec: function(cmd,args) {
			
		},
		
		/**
		 * registerOnHide
		 * 
		 * Because we destroy all dialogs on close, we may want to make sure any post-hide events
		 * have time to complete before we destroy the dialog. This allows the registration of a
		 * Deferred which will hold the destroy method until it resolves.
		 * 
		 * 
		 */
		registerOnHide: function() {
			// Don't make a new Deferred if one is already outstanding!
			if(this.postHideDone_.isResolved()) {
				this.postHideDone_ = new Deferred();	
			}
			return this.postHideDone_;
		},
		
		registerOnShow: function(callback,justOnce) {
			var self=this;
			if(callback) {
				var afterHandler = aspect.after(this,"show",function(promise,e){
					if(justOnce) {
						afterHandler.remove();	
					}
					callback(e);
					return promise;
				});
				if(!justOnce) {
					self.own(afterHandler);
				}
			}
		},
		
		destroyImmediates: function() {
			DojoArray.forEach(this.forImmediateDestruction,function(destroyNow){
				destroyNow.destroyRecursive();
			});
			this.forImmediateDestruction = [];
		},
		
		// Nonmodal Dialogs should not try to refocus to themselves, since
		// ability to focus outside the dialog is inherent in nonmodality.
		focus: function() {
			if(this["class"] !== "nonModal") {
				this.inherited(arguments);
			}
		},
		
		constructor: function(params) {
			declare.safeMixin(this,params);
			// Initially set up postHide to return immediately; if a method needs to 
			// register an onHide later, it will make a new Deferred
			this.postHideDone_ = new Deferred();
			this.postHideDone_.resolve();
			this.inherited(arguments);
			
			var self=this;
			
			this.own(aspect.after(this,"show",function(promise,e){
				
				if(self["class"] !== "nonModal") {
					require(["dialogs"],function(BTDialogs){
						BTDialogs.registerModalDialog(self.id);
					});						
				}
				
				// openAt is for all dialogs of a given type,
				// but offset is for a specific dialog instance
				var diagParent = self.containerNode.parentNode;

				if((self.openAt || self.offset) && self.alwaysMove) {
					domStyle.set(
						diagParent,
						"left",
						domStyle.get(diagParent,"left") + 
							(self.openAt ? self.openAt.x : 0) + 
							(self.offset ? self.offset.x : 0) + "px"
					);
					domStyle.set(
						diagParent,
						"top",
						domStyle.get(diagParent,"top") + 
							(self.openAt ? self.openAt.y : 0) + 
							(self.offset ? self.offset.y : 0) + "px"
					);
				}
				return promise;
			}));
			
			require(["dojo/on"],function(on){
				self.own(on(self,"hide",function(e){
					self.postHideDone_.promise.then(function(){
						self.destroyImmediates();						
						self.destroyRecursive();
					});
				}));
			});
		}
	});
});