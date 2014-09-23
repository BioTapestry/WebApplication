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
    "controllers/XhrController",
    "dojo/dom",
    "dojo/html",
    "dojo/dom-construct",
    "static/XhrUris",
    "dojo/query"
],function(
	xhrController,
	dom,
	dojoHtml,
	domConstruct,
	XhrUris,
	query
){
		
	var uriBase_ = null;
	var MAX_RETRIEVAL_RETRIES = 5;
	
	return {
		SET_ONCLOSE: function(args,source) {
			window.onbeforeunload = function(e){
				source.postMessage({cmd: "CLIENT_CLOSED_WINDOW",args: {windowId: args.id}},window.location.origin);
			};
		},
		
		SET_TITLE: function(args) {
			window.document.title = args.title;
		},
		
		LOAD_DATA: function(args) {
			if(args.dialogDomNode) {
				var expDataDomNode = query(args.queryString,args.dialogDomNode)[0];
				args.loadTo = expDataDomNode.id;
				dom.byId(args.dialog.id + "_title").innerHTML = args.title;
			} else if(args.title) {
				window.document.title = args.title;
				require(["views/expdata/main"],function(ExpDataView){
					ExpDataView.setHeaderText(args.title || "Experimental Data Display");
				});	
			}
			
			if(!args.loadTo) {
				args.loadTo = "center_pane";
			}
			
			if(args.preFetched) {
				dojoHtml.set(dom.byId(args.loadTo),args.expData,{extractContent: true});
			} else {
				if(args.cmdKey) {
					var retry = 0;
					var fetchData = function() {
						xhrController.xhrRequest(XhrUris.cmd(args.cmdClass, args.cmdKey,{objectID: args.objId, genomeID: args.genomeKey})).then(function(response){
							if(response.resultsMap.ExperimentalData.incomplete) {
								dojoHtml.set(dom.byId(args.loadTo),response.resultsMap.ExperimentalData.HTML,{extractContent: true});
								if(retry < MAX_RETRIEVAL_RETRIES) {
									setTimeout(fetchData,3000); 
									retry++;
								} else {
									dojoHtml.set(dom.byId(args.loadTo),"<p>Unable to load experimental data!</p>",{extractContent: false});
								}
							} else {
								dojoHtml.set(dom.byId(args.loadTo),response.resultsMap.ExperimentalData.HTML,{extractContent: true});
								if(args.dialogDomNode) {
									var expDataDomNode = query(args.queryString,args.dialogDomNode)[0];
									args.loadTo = expDataDomNode.id;
									dom.byId(args.dialog.id + "_title").innerHTML = response.resultsMap.FrameTitle || args.title || "Experimental Data Display";
								} else if(args.title) {
									window.document.title = response.resultsMap.FrameTitle || args.title || "Experimental Data Display";
									require(["views/expdata/main"],function(ExpDataView){
										ExpDataView.setHeaderText(args.title || "Experimental Data Display");
									});	
								}
							}
							if(args.windowLink) {
								domConstruct.place(args.windowLink,dom.byId(args.loadTo),"first");
							}
						},function(e){
							console.error("[ERROR] Error in Experimental Data loading:"+e);
						});
					};
					fetchData();
				} else {
					console.error("[ERROR] Can't fetch experimental data without a command key!");				
				}
			}
			if(args.windowLink) {
				domConstruct.place(args.windowLink,dom.byId(args.loadTo),"first");
			}
		}
	};
});