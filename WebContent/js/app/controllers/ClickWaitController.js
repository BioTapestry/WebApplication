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
    "dojo/_base/array",
    "dojo/on",
    "dojo/dom",
    "views/BioTapestryCanvas",
    "dojo/dom-style"
],function(
	DojoArray,
	on,
	dom,
	BTCanvas,
	domStyle
) {


	var _installedClicks = {};
	
	function _installClick(params) {
		domStyle.set(window.document.body,"cursor","crosshair");
		_installedClicks[params.clickId] = {
			handler: on(dom.byId(params.canvasId),"click",params.callback),
			canvasId: params.canvasId,
			type: params.type
		};
		
		require(["views"],function(BTViews){
			params.statesAndMasks && BTViews.updateViewStates(params.statesAndMasks);			
		});
		
		// click specifics here
		switch(params.type) {
			case "ACTION":
				BTCanvas.actionClickPending(params.canvasId,true);
				break;
			default:
				console.error("[ERROR] This click type is not recognized: " + params.type);
				break;				
		}
	};
	
	function _uninstallClick(params) {
		if(_installedClicks[params.clickId] && _installedClicks[params.clickId]) {
			domStyle.set(window.document.body,"cursor","default");
			_installedClicks[params.clickId] && _installedClicks[params.clickId]["handler"] && _installedClicks[params.clickId]["handler"].remove(); 
			require(["views"],function(BTViews){
				params.statesAndMasks && BTViews.updateViewStates(params.statesAndMasks);			
			});
			
			// click specifics here
			switch(_installedClicks[params.clickId].type) {
				case "ACTION":
					BTCanvas.actionClickPending(_installedClicks[params.clickId].canvasId,false);
					break;
				default:
					console.error("[ERROR] This click type is not recognized: " + params.type);
					break;
			}
		}
	};
		
		
	return {
		
		///////////////////////////////
		// installClick
		///////////////////////////////
		//
		// params:
		// 	clickId: the ID to use in accessing/storing this click event
		// 	canvasId: ID of the canvas whose events we will disabled for the duration of the click, and
		// 		which will be the target of the click event
		// 	callback: the callback which will fire once the click event occurs
		// 	statesAndMasks: any masking and stating to occur while the click event is active (optional)
		//
		installClick: function(params) {
			if(_installedClicks[params.clickId]) {
				_uninstallClick(params);
			}
			_installClick(params);
			
		},
		
		/////////////////////////////////
		// uninstallClick
		///////////////////////////////
		//
		//
		// thisClick: ID of the click to remove
		// statesAndMasks: masks and states  to apply after removal (optional)
		uninstallClick: function(thisClick,statesAndMasks) {
			_uninstallClick({clickId: thisClick, statesAndMasks: statesAndMasks});
		},
		
		uninstallAllClicks: function(statesAndMasks) {
			for(var i in _installedClicks) {
				if(_installedClicks.hasOwnProperty(i)) {
					_uninstallClick({clickId:i,statesAndMasks: statesAndMasks});
				}
			}
		}
	};

});