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
	"dojo/Deferred",
    "dojo/_base/array",
	"dijit/form/Button",
	"dijit/form/RadioButton",
	"./CheckBox",
	"dijit/form/TextBox",
	"dijit/form/ValidationTextBox",
	"dijit/form/Textarea",
	"dijit/layout/ContentPane",
	"dijit/layout/BorderContainer",
	"dijit/layout/TabContainer",
	"./ComboBox",
	"./SelectionGroup",
    "dgrid/Grid",
    "./DialogCanvas",
    "dgrid/Keyboard",
    "dgrid/Selection",
    "dgrid/extensions/ColumnHider",
    "dgrid/extensions/DijitRegistry",
    "dgrid/extensions/ColumnResizer",
    "controllers/XhrController",
    "static/XhrUris",
    "static/ErrorMessages",
    "./TextMessage",
    "dijit/Destroyable"
],function(
	declare,
	Deferred,
	DojoArray,
	Button,
	RadioButton,
	CheckBox,
	TextBox,
	ValTextBox,
	TextArea,
	ContentPane,
	BorderContainer,
	TabContainer,
	BTComboBox,
	BTSelectionGroup,
	Grid,
	DialogCanvas,
	Keyboard,
	Selection,
	ColumnHider,
	DijitRegistry,
	ColumnResizer,
	XhrController,
	XhrUris,
	ErrorMsgs,
	TextMessage,
	Destroyable
) {
	
	var clientMode_ = "VIEWER";
		
	// dgrid's DijitRegistry does NOT implement own(), but Destroyable DOES implement destroy, which clobbers the DijitRegistry
	// destroy. Destroyable and DijitRegistry must **always** be mixed in this order, or Destroyable will supercede the DijitRegistry
	// methods and then destruction of grids will fail.
	var SelectableGrid = declare([ Grid, Keyboard, Selection, ColumnHider, Destroyable, DijitRegistry, ColumnResizer ], {
		disabled: false,
		disable: function(val) {
			this.disabled = val;
			if(val) {
				this.refresh();
				this.renderArray([]);
			}
		}
	});
	
	var Elements = {
		TEXT_BOX_SINGLE: TextBox,
		TEXT_BOX_SINGLE_VALIDATED: ValTextBox,
		TEXT_BOX: TextBox,
		TEXT_BOX_MULTI: TextArea,
		TEXT_BOX_AREA: TextArea,
		BUTTON: Button,
		RADIO_BUTTON: RadioButton,
		CHECKBOX: CheckBox,
		SELECTION_GROUP: BTSelectionGroup,
		PANE: ContentPane,
		TAB_CONTAINER: TabContainer,
		LAYOUT_CONTAINER: BorderContainer,
		TEXT_MESSAGE: TextMessage,
		GRID: SelectableGrid,
		LISTSELECT: SelectableGrid,
		DRAWING_AREA: DialogCanvas,
		COMBO_BOX_TEXT: BTComboBox
	};
	
	/////////////////////////////
	// _gridRenderers
	/////////////////////////////
	//
	// dgrid elements sometimes need special rendering performed on them; this is
	// done with a GridRenderer. Predefined grid renderers allow a grid renderer
	// specification to be set on the incoming list object so it can be retrieved here
	//
	// A GridRenderer is a function named for the field it will be rendering
	
	var _gridRenderers = {
		signIcon: {
			sign: function(object, data, td, options) {
				var iconClass = "iconContainer BioTapIcons524 ";
				switch(object.sign) {
					case 1:
						iconClass += "BioTapIcons524LinkPlus";
						break;
					case -1: 
						iconClass += "BioTapIcons524LinkMinus";
						break;
					case 0:
						iconClass += "BioTapIcons524LinkQuestion";
						break;								
				}
				td.innerHTML = '<span class="' + iconClass + '"></span>';
			}
		},
		indentedColumn: {
			display: function(object,data,td,options) {
				if(object.needsIndent) {
					td.innerHTML = '<p class="LeftIndent">'+object.display+'</p>';
				} else {
					td.innerHTML = object.display;
				}
			}
		}			
	};
	
	/////////////////////////////////////
	// _dialogDefs
	////////////////////////////////////
	// 
	// Predefined dialogs which will not be fetched from the server, or
	// failover dialogs for when window popups are not allowed
	//
	var _dialogDefs = {
		ABOUT: {
			name: "ABOUT",
			dialogType: "PLAIN",
			parameters: {title: "About BioTapestry",id: "about_dialog",style: "height 750px; width: 680px;",openAt: {x: 0,y: 0}},
			dialogElementCollections: {
				mainPane: {
					elementType: "LAYOUT_CONTAINER",
					collectionElements: {
						center: [
					         {
					        	 elementType: "PANE",
					        	 parameters: {id: "about_img",content: "<img src=\"images/BioTapestrySplash.gif\" width=\"465\" "
					        		 + "height=\"300\" style=\"margin-left: auto; margin-right: auto; display: block;\"/>"},
					        	 layout:{layoutParameters:{region:"center",ordinal:"0"},layoutType:"REGIONAL"}
					         },{
					        	 elementType: "PANE",
					        	 parameters: {id: "about_text_container",content: "", style: "border: 1px solid black;"},
						   		layout:{layoutParameters:{region:"center",ordinal:"1"},layoutType:"REGIONAL"}
					         }
					    ],
				      	bottom: [{
		      	    	   	elementType: "BUTTON",
		      	    	   	parameters: {label: "Close", id: "close_btn", "class": "RightHand"},
		      	    	   	events: {click: {uiElementActions: ["DIALOG_CLOSE"], cmdAction: "DO_NOTHING"}},
		      	    	   	layout:{layoutParameters:{region:"bottom",ordinal:"0"},layoutType:"REGIONAL"}
	      	    	   	}]
					},
					parameters: {
						style: "height: 730px; width: 660px;",
						gutters: "false"
					}					
				}
			}
		},
		EXP_DATA: {
			name: "EXP_DATA",
			dialogType: "PLAIN",
			parameters: {
				title: "BioTapestry Experimental Data",id: "exp_data_dialog",style: "height 600px; width: 1000px;", 
				showImmediately: true, openAt: {x: 0,y: 0}, alwaysMove: true
			},
			dialogElementCollections: {
				mainPane: {
					elementType: "LAYOUT_CONTAINER",
					collectionElements: {
						center: [
					         {
					        	 elementType: "TEXT_MESSAGE",
					        	 parameters: {id: "dialog_message", content: ""},
					        	 layout:{layoutParameters:{region:"center",ordinal:"0"},layoutType:"REGIONAL"}
					         },{
					        	 elementType: "PANE",
					        	 parameters: {id: "exp_data_container",content: ""},
					        	 layout:{layoutParameters:{region:"center",ordinal:"1"},layoutType:"REGIONAL"}
					         }
				         ]
					},
					parameters: {
						style: "height: 700px; width: 975px;",
						gutters: "false",
						content: "Loading..."
					}					
				}
			}
		},
		PATH_DISPLAY: {
			name: "PATH_DISPLAY",
			dialogType: "PLAIN",
			parameters: {
				title: "Show Parallel Paths",id: "pathing_dialog",
				style: "height 600px; width: 945px;", isEmpty: true, 
				showImmediately: false, destroyImmediate: true,
				openAt: {x: 0,y: 0},
				alwaysMove: false
			}
		},
		YES_NO: {
			name: "YES_NO",
			dialogType: "PLAIN",
			parameters: {title: "Proceed?",id: "basic_yes_no_modal_dialog",isModal: true,style: "height 400px; width: 400px;",openAt: {x: 0,y: 0}},
			dialogElementCollections: {
				mainPane: {
					elementType: "LAYOUT_CONTAINER",
					collectionElements: {
						center: [{
						   elementType: "TEXT_MESSAGE",
						   parameters: {id: "yes_no_unset_message",content: "Basic Yes/No Question"},
						   layout:{layoutParameters:{region:"center",ordinal:"0"},layoutType:"REGIONAL"}
						}],
				      	bottom: [{
		      	    	   	elementType: "BUTTON",
		      	    	   	"float": true,
		      	    	   	parameters: {label: "Yes", id: "yes_btn",clickValue: "YES"},
		      	    	   	events: {click: {parameters: {storeClick: true},uiElementActions: ["DIALOG_CLOSE","BLANK_FORM"], cmdAction: "DO_NOTHING"}},
		      	    	   	layout:{layoutParameters:{region:"bottom",ordinal:"0"},layoutType:"REGIONAL"}
	      	    	   	},{
		      	    	   	elementType: "BUTTON",
		      	    	   	"float": true,
		      	    	   	parameters: {label: "No", id: "no_btn", clickValue: "NO"},
		      	    	   	events: {click: {parameters: {storeClick: true}, uiElementActions: ["DIALOG_CLOSE","BLANK_FORM"], cmdAction: "DO_NOTHING"}},
		      	    	   	layout:{layoutParameters:{region:"bottom",ordinal:"1"},layoutType:"REGIONAL"}
	      	    	   	}]
					},
					parameters: {
						style: "height: 175px; width: 375px;",
						gutters: "false"
					}					
				}
			}	
		},
		BASIC_ERROR: {
			name: "BASIC_ERROR",
			dialogType: "ERROR",
			parameters: {title: "Error!",id: "basic_error_modal_dialog",isModal: true,style: "height 400px; width: 400px;",openAt: {x: 0,y: 0}},
			dialogElementCollections: {
				mainPane: {
					elementType: "LAYOUT_CONTAINER",
					collectionElements: {
						center: [{
						   elementType: "TEXT_MESSAGE",
						   parameters: {id: "error_unset_message",content: "Basic Error Mesage"},
						   layout:{layoutParameters:{region:"center",ordinal:"0"},layoutType:"REGIONAL"}
						}],
				      	bottom: [{
		      	    	   	elementType: "BUTTON",
		      	    	   	parameters: {label: "OK", id: "ok_btn"},
		      	    	   	events: {click: {uiElementActions: ["DIALOG_CLOSE","BLANK_FORM"], cmdAction: "DO_NOTHING"}},
		      	    	   	layout:{layoutParameters:{region:"bottom",ordinal:"0"},layoutType:"REGIONAL"}
	      	    	   	}]
					},
					parameters: {
						style: "height: 175px; width: 375px;",
						gutters: "false"
					}					
				}
			}
		}		
	};
	
	//////////////////////
	// _loadDialogDef
	/////////////////////
	//
	// Load a dialog definition from the server. 
	// 
	function _loadDialogDef(dialogType) {
		var loadAsync = new Deferred();
		var self=this;
		XhrController.xhrRequest(XhrUris.getDialog(dialogType)).then(function(dialogDef){
			// We don't want definitions to be altered by the DialogFactory, so make a 
			// clone of it using stringify
			_dialogDefs[dialogType] = JSON.parse(JSON.stringify(dialogDef));
			loadAsync.resolve(dialogDef);
		});
	};
		
	return {
		makeBasicErrorDef: function(errorMsg,title) {
			var basicErrorDef  = JSON.parse(JSON.stringify(_dialogDefs["BASIC_ERROR"]));
			basicErrorDef.dialogElementCollections.mainPane.collectionElements.center[0].parameters.content = errorMsg;
			basicErrorDef.parameters.title = title;
			return basicErrorDef;
		},
		makeYesNoDef: function(msg,title) {
			var yesNoDef  = JSON.parse(JSON.stringify(_dialogDefs["YES_NO"]));
			yesNoDef.dialogElementCollections.mainPane.collectionElements.center[0].parameters.content = msg;
			yesNoDef.parameters.title = title;
			return yesNoDef;
		},		
		makeFailoverDef: function(params) {
			var failoverDef  = JSON.parse(JSON.stringify(_dialogDefs[params.type]));
			if(params.id) {
				failoverDef.parameters.id += ("_"+params.id);
				if(!failoverDef.parameters.isEmpty) {
					failoverDef.dialogElementCollections.mainPane.collectionElements.center[0].parameters.id += ("_"+params.id); 
					failoverDef.dialogElementCollections.mainPane.collectionElements.center[1].parameters.id += ("_"+params.id);
				}
				delete params.id;
			}
			
			declare.safeMixin(failoverDef.parameters,params);
			if(params.withErrorMsg && failoverDef.dialogElementCollections) {
				failoverDef.dialogElementCollections.mainPane.collectionElements.center[0].parameters.content = ErrorMsgs.popupsBlocked;
			}
			failoverDef.parameters.exec = function(cmd,args) {
				require([params.frameController],function(controller){
					controller[cmd](args);
				});
			};
			return failoverDef;			
		},
				
		getDialogDef: function(dialogType) {
			return _dialogDefs[dialogType];
		},
		fetchDialogDef: function(dialogType) {
			var loadAsync = new Deferred();
			if(!_dialogDefs[dialogType]) {
				return _loadDialogDef();
			}
			loadAsync.resolve(_dialogDefs[dialogType]);
			return loadAsync.promise;
		},
		addDialogDef: function(name,def) {
			_dialogDefs[name] = def;
		},
		isDialogDefined: function(name) {
			return (!!_dialogDefs[name]);
		},
		
		getElement: function(elementType) {
			return Elements[elementType];
		},
		
		getGridRenderers: function(renderer) {
			return _gridRenderers[renderer];
		}
	};

});	
	