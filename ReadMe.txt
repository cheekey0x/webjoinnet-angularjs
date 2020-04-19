* Test
1. Set up a web server (such as xampp Apache) at the local computer
2. Add an aliase such as
	<Directory "C:/yourfolder/webjoinnet-angularjs">
		Require all granted
		AllowOverride All
		Order allow,deny
		Allow from all
	</Directory>
    Alias /webjoinnet-angularjs "C:/yourfolder/webjoinnet-angularjs"
3. The web App can be tested at http://localhost/webjoinnet-angularjs/

* Debug
1. In the file index-dummy.htm, there are two groups of <script>
   The first group contains only two entries:
	  <script src="dep.min.js?random=0"></script>
	  <script src="hmtgs.min.js?random=0"></script>
   They are used for production.
   
   The second group contains more entries.
2. At the bottom of file index.htm, there are two lines:
	  <script src="dep.min.js?random=0"></script>
	  <script src="hmtgs.min.js?random=0"></script>
   This part can be replaced with the second group of <script> in the index-dummy.htm
   After the replacement, the http://localhost/webjoinnet-angularjs/ will use the source codes directly
   
3. Remember to restore to the first <script> group as in the index-dummy.htm for production release

4. Some times, the browser may stuck at the cache even the source code has been modified.
   To force the browser to load the latest source codes, change the following two places at the same time:
   a) window.cache_detection_string in file cache_detection.js
   b) hmtg.config.APP_VERSION in file app/version.js
   
   These two variables MUST be the same at all times.
   Changing them from '3.2.0' to '3.2.0.anyrandomstring' will force the browser to load the latest source codes.
   
* Prepare for production deployment
1. The index.htm should use the production <script> entries as in the index-dummy.htm
2. Modify the cache and APP_VERSION to the target version number
3. Run build.bat
4. The folder 'dist' now contains the content that can be deployed to a public web server
5. The production content can be tested locally at http://localhost/webjoinnet-angularjs/dist/
   
   
   
   
