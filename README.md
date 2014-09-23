WebApplication
==============

Source for Web Client Installation (Now at Version 1.0.0)

Required Javascript Libraries

	* In js/lib: 
		Dojo + Dijit 1.10, http://dojotoolkit.org/download/
			- The 'biotapestry' theme folder found in dijit-theme/ should be placed 
			  in js/lib/dijit/themes/
		dgrid, https://github.com/sitepen/dgrid#manual-download
		xstyle, https://github.com/kriszyp/xstyle
		put-selector, https://github.com/kriszyp/put-selector
		
	* In js/lib/utils:
		Underscore, http://underscorejs.org/
		
Required Java Libraries
		
	* In WEB-INF/lib:
		BioTapestry 7.0, https://github.com/BioTapestry/Production
		FlexJson 2.1, http://flexjson.sourceforge.net/
		

Configuring the Display
-----------------------

- Place your BTP file in WEB-INF/data
- Edit configuration.txt's modelfile line (modelfile=&lt;Filename&gt;.btp) to indicate what the actively displayed file should be
- Edit customizations/Title.html to reflect the text you would like to display in the header
