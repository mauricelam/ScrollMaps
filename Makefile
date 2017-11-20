#####
#
# Common commands:
#
# make
#     This makes a development version of the plugin under gen/plugin-10000
# make test
#     This loads a list of URLs to test the plugin on
#
# VERSION=X.X make release
#     Create a zipped release file and open links to GitHub and Chrome webstore
#
#####

ifndef VERSION
    VERSION := 10000
endif

ALL_SOURCE_FILES := \
    $(wildcard *.js) \
    $(wildcard *.css) \
    $(wildcard *.html) \
    $(wildcard options/*.js) \
    $(wildcard options/*.css) \
    $(wildcard options/*.html) \
    $(wildcard images/*.png)

PLUGIN_DIR := gen/plugin-$(VERSION)

GENERATED_FILES := \
    $(PLUGIN_DIR)/manifest.json \
    $(PLUGIN_DIR)/inject_content.min.js

define CONTINUE
@read -p "Press any key to continue... " -n1 -s; echo "\n"
endef

define \n


endef

.PHONY: fill-$(VERSION)
fill-$(VERSION): $(PLUGIN_DIR) $(ALL_SOURCE_FILES) $(GENERATED_FILES)
	rsync -R $(ALL_SOURCE_FILES) $(PLUGIN_DIR)

$(PLUGIN_DIR): $(ALL_SOURCE_FILES)
	mkdir -p $@

$(PLUGIN_DIR)/manifest.json: generate_manifest.py manifest_template.json
	./generate_manifest.py $@ $(VERSION)

$(PLUGIN_DIR)/inject_content.min.js: inject_content.js
	uglifyjs --compress drop_debugger=false --drop_debugger -o $@ -- $^

gen/scrollmaps-$(VERSION).zip: fill-$(VERSION)
	zip -r $@ $(PLUGIN_DIR)

.PHONY: release
ifneq ($(VERSION),10000)
release: gen/scrollmaps-$(VERSION).zip
	open gen
	open "https://github.com/mauricelam/ScrollMaps/releases/new?tag=$(VERSION)"
	$(CONTINUE)
	open "https://chrome.google.com/webstore/developer/edit/jifommjndpnefcfplgnbhabocomgdjjg"
else
release:
	$(error "Cannot make with VERSION=10000")
endif


##### Test #####

TEST_URLS := \
    https://developers.google.com/maps/documentation/javascript/styling \
    https://developers.google.com/maps/documentation/embed/guide \
    http://maps.google.com/?force=tt \
    http://maps.google.be/ \
    http://en.parkopedia.com/parking/san_francisco_ca_united_states/?ac=1&country=US&lat=37.7749295&lng=-122.41941550000001 \
    https://developers.google.com/maps/documentation/javascript/signedin \
    https://developers.google.com/maps/documentation/javascript/examples/polygon-draggable \
    https://developers.google.com/maps/documentation/javascript/examples/layer-data-quakes \
    https://developers.google.com/maps/documentation/javascript/examples/layer-georss \
    https://developers.google.com/maps/documentation/javascript/examples/streetview-embed \
    https://developers.google.com/maps/documentation/javascript/examples/drawing-tools \
    https://www.google.com/maps/@?force=lite&dg=opt&newdg=1 \
    https://www.google.com/fusiontables/DataSource?docid=1jtmdb0D2ykY3_OmNhqiyBoiiv9B3jLNZBIffVMKR\#map:id=4 \
    https://www.google.com/maps/d/viewer?mid=1ZpcZ8OMZh1G1XwRmt9GaCwH6f-g&amp%3Bhl=en \
    https://www.geckoboard.com/tech-acquisitions/

MAPBOX_TEST_URLS := \
    https://www.wunderground.com/

.PHONY: test
test:
	$(foreach url,$(TEST_URLS),@read -p "Open $(url)? [Y/n] " -n1 input; echo "\n";if [[ "$$input" != 'n' ]]; then open "$(url)"; fi ${\n})
