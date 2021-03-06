<template>
  <div style="height: auto;"
    :style="$vuetify.breakpoint.mdAndDown && 'padding-bottom: 100px'"
  >
    <v-container class="pt-0" :class="showFullScreen && 'showFullScreenButton'">
      <v-row v-if="indicatorObject">
        <v-col
          cols="12"
        >
          <v-tabs
            v-if="multipleTabCompare"
            v-model="selectedSensorTab"
            grow
          >
            <v-tab
              v-for="(sensorData, index) in multipleTabCompare.features"
              :key="sensorData.properties.indicatorObject.id"
              :class="multipleTabCompare.features.indexOf(sensorData) == selectedSensorTab
                ? 'primary white--text'
                : ''"
            >
              {{ Array.isArray(multipleTabCompare.label)
                ? multipleTabCompare.label[index]
                : (Array.isArray(sensorData.properties.indicatorObject[multipleTabCompare.label])
                ? sensorData.properties.indicatorObject[multipleTabCompare.label][0]
                : sensorData.properties.indicatorObject[multipleTabCompare.label])
              }}
            </v-tab>
          </v-tabs>
          <v-tabs-items
            v-if="multipleTabCompare"
            touchless
            v-model="selectedSensorTab"
          >
            <v-tab-item
              v-for="sensorData in multipleTabCompare.features"
              :key="sensorData.properties.indicatorObject.id"
              :transition="false" :reverse-transition="false"
            >
              <v-card
                class="fill-height"
                :style="`height: ${$vuetify.breakpoint.mdAndUp ? (expanded ? 70 : 40) : 60}vh;`"
              >
                <full-screen-button v-if="showFullScreen" />
                <div
                  style="height: 100%;z-index: 500; position: relative;"
                  v-if="$vuetify.breakpoint.mdAndDown && !dataInteract"
                  @click="dataInteract = true"
                  v-touch="{
                    left: () => swipe(),
                    right: () => swipe(),
                    up: () => swipe(),
                    down: () => swipe(),
                }">
                </div>
                <v-overlay :value="overlay" absolute
                  v-if="!dataInteract"
                  @click="dataInteract = true">
                  Tap to interact
                </v-overlay>
                <indicator-map
                  ref="indicatorMap"
                  style="top: 0px; position: absolute;"
                  v-if="['all'].includes(sensorData.properties.indicatorObject.country) ||
                  Array.isArray(sensorData.properties.indicatorObject.country)"
                  class="pt-0 fill-height"
                  :currentIndicator="sensorData.properties.indicatorObject"
                  v-on:fetchCustomAreaIndicator="scrollToCustomAreaIndicator"
                />
                <indicator-data
                  style="top: 0px; position: absolute;"
                  v-else
                  class="pa-5 chart"
                  :currentIndicator="sensorData.properties.indicatorObject"
                />
              </v-card>
            </v-tab-item>
          </v-tabs-items>
          <v-card
            v-else
            class="fill-height"
            :style="`height: ${$vuetify.breakpoint.mdAndUp ? (expanded ? 70 : 40) : 60}vh;`"
          >
            <full-screen-button v-if="showFullScreen" />
            <div
              style="height: 100%;z-index: 500; position: relative;"
              v-if="$vuetify.breakpoint.mdAndDown && !dataInteract"
              @click="dataInteract = true"
              v-touch="{
                left: () => swipe(),
                right: () => swipe(),
                up: () => swipe(),
                down: () => swipe(),
            }">
            </div>
            <v-overlay :value="overlay" absolute
              v-if="!dataInteract"
              @click="dataInteract = true">
              Tap to interact
            </v-overlay>
            <indicator-map
              ref="indicatorMap"
              v-on:fetchCustomAreaIndicator="scrollToCustomAreaIndicator"
              style="top: 0px; position: absolute;"
              v-if="showMap"
              class="pt-0 fill-height"
            />
            <indicator-data
              style="top: 0px; position: absolute;"
              v-else
              class="pa-5 chart"
            />
          </v-card>
        </v-col>

        <v-col
          cols="12"
          sm="5"
          class="py-0 my-0 d-flex align-center"
          :class="$vuetify.breakpoint.xsOnly ? 'justify-center' : 'justify-space-between'"
        >
          <small v-if="indicatorObject && indicatorObject.updateFrequency">
            <span
              v-if="indicatorObject.updateFrequency === 'Retired'"
            >This indicator is no longer updated</span>
            <span
              v-else-if="indicatorObject.updateFrequency === 'EndSeason'"
            >Due to end of season, this indicator is no longer updated</span>
            <span v-else>This data is updated: {{ indicatorObject.updateFrequency }}</span>
          </small>
          <small v-else> </small>
        </v-col>
        <v-col
          cols="12"
          sm="7"
          class="py-0 my-0"
        >
          <div :class="$vuetify.breakpoint.xsOnly ? 'text-center' : 'text-right'">
            <v-btn
              color="primary"
              text
              small
              :href="dataHrefCSV"
              :download="downloadFileName"
              target="_blank"
              v-if="indicatorObject && !showMap"
            >
              <v-icon left>mdi-download</v-icon>
              download csv
            </v-btn>
            <iframe-button :indicatorObject="indicatorObject"/>
          </div>
        </v-col>
        <v-col
          cols="12"
          ref="customAreaIndicator"
          class="pa-0"
        >
          <v-card
            v-if="customAreaIndicator"
            class="fill-height"
            :style="`height: ${$vuetify.breakpoint.mdAndUp ? (expanded ? 70 : 40) : 60}vh;`"
          >
            <div
              style="height: 100%;z-index: 500; position: relative;"
              v-if="$vuetify.breakpoint.mdAndDown && !dataInteract"
              @click="dataInteract = true"
              v-touch="{
                left: () => swipe(),
                right: () => swipe(),
                up: () => swipe(),
                down: () => swipe(),
            }">
            </div>
            <indicator-data
              style="top: 0px; position: absolute;"
              class="pa-5 chart"
            />
          </v-card>
        </v-col>
        <v-col
          cols="12"
        >
        <div>
            <expandable-content>
              <div
                v-html="story"
                class="md-body"
              ></div>
            </expandable-content>
            <v-btn
              v-if="eodataEnabled"
              @click="dialog = true"
              color="primary"
              large
              block
              class="my-5"
            ><span><v-icon left>mdi-satellite-variant</v-icon>EO Data</span>
            </v-btn>
            <v-btn
              v-if="indicatorObject && externalData"
              :href= "externalData.url"
              target="_blank"
              color="primary"
              large
              block
              class="my-5"
            ><span><v-icon left>mdi-open-in-new</v-icon>{{externalData.label}}</span>
            </v-btn>
          </div>
          <v-dialog
            v-model="dialog"
            fullscreen
            hide-overlay
            transition="dialog-bottom-transition"
          >
            <v-toolbar dark color="primary">
              <v-toolbar-title >
                <span
                >Reference Images</span>
              </v-toolbar-title>
              <v-spacer></v-spacer>
              <v-btn icon dark @click="dialog = false">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </v-toolbar>
          <indicator-map
            ref="referenceMap"
            :style="`height: calc(100% - ${$vuetify.application.top}px)`"
          />
          </v-dialog>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
import {
  mapGetters,
  mapState,
} from 'vuex';

import { loadIndicatorData } from '@/utils';
import { DateTime } from 'luxon';
import dialogMixin from '@/mixins/dialogMixin';

import ExpandableContent from '@/components/ExpandableContent.vue';
import IndicatorData from '@/components/IndicatorData.vue';
import IndicatorMap from '@/components/IndicatorMap.vue';
import FullScreenButton from '@/components/FullScreenButton.vue';
import IframeButton from '@/components/IframeButton.vue';

export default {
  mixins: [dialogMixin],
  props: [
    'expanded',
  ],
  components: {
    ExpandableContent,
    IndicatorData,
    IndicatorMap,
    FullScreenButton,
    IframeButton,
  },
  data: () => ({
    dialog: false,
    overlay: false,
    dataInteract: false,
    mounted: false,
    selectedSensorTab: 0,
    multipleTabCompare: null,
  }),
  computed: {
    ...mapGetters('features', [
      'getCountries',
      'getIndicators',
      'getLatestUpdate',
    ]),
    ...mapState('config', [
      'appConfig',
      'baseConfig',
    ]),
    showFullScreen() {
      const isSafari = !!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/); // eslint-disable-line
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      return !isSafari && !iOS;
    },
    story() {
      let markdown;
      try {
        markdown = require(`../../public${this.appConfig.storyPath}${this.getLocationCode(this.indicatorObject)}.md`);
      } catch {
        try {
          markdown = require(`../../public${this.baseConfig.indicatorsDefinition[this.indicatorObject.indicator].story}.md`);
        } catch {
          markdown = { default: '' };
        }
      }
      return this.$marked(markdown.default);
    },
    indicatorObject() {
      let indicatorObject;
      if (this.multipleTabCompare) {
        const feature = this.multipleTabCompare.features[this.selectedSensorTab];
        indicatorObject = feature && feature.properties.indicatorObject;
      } else {
        indicatorObject = this.$store.state.indicators.selectedIndicator;
      }
      return indicatorObject;
    },
    dataHrefCSV() {
      let dataHref = 'data:text/csv;charset=utf-8,';
      const exportKeys = [
        'time', 'aoi', 'measurement',
        'indicatorValue', 'referenceTime', /* 'referenceValue', */
        'dataProvider', 'eoSensor', 'colorCode', 'inputData',
      ];
      const header = `${exportKeys.join()}\n`;
      let csv = header;
      for (let i = 0; i < this.indicatorObject.time.length; i++) {
        let row = '';
        for (let kk = 0; kk < exportKeys.length; kk++) {
          const cKey = exportKeys[kk];
          let txtVal = '';
          if (cKey === 'aoi') {
            txtVal = `"${this.indicatorObject[cKey]}",`;
          } else {
            txtVal = `"${this.indicatorObject[cKey][i]}",`;
          }
          row += txtVal;
        }
        row = `${row.slice(0, -1)}\n`;
        csv += row;
      }
      dataHref += encodeURI(csv);
      return dataHref;
    },
    downloadFileName() {
      const currDate = DateTime.utc().toFormat('yyyy-LL-dd');
      const currInd = this.indicatorObject;
      return `${currInd.city}_${currDate}_${currInd.aoiID}-${currInd.indicator}.csv`;
    },
    customAreaIndicator() {
      return this.$store.state.indicators.customAreaIndicator;
    },
    layerNameMapping() {
      return this.baseConfig.layerNameMapping;
    },
    showMap() {
      // if returns true, we are showing map, if false we show chart
      return ['all'].includes(this.indicatorObject.country) || Array.isArray(this.indicatorObject.country);
    },
    externalData() {
      const dataFromDefinition = this.baseConfig.indicatorsDefinition[
        this.indicatorObject.indicator
      ].externalData;
      const dataFromIndicator = this.indicatorObject.externalData;
      if (dataFromDefinition) {
        return dataFromDefinition;
      }
      if (dataFromIndicator) {
        return dataFromIndicator;
      }
      return null;
    },
    eodataEnabled() {
      const lastInputData = (this.indicatorObject && this.indicatorObject.inputData)
        ? this.indicatorObject.inputData[this.indicatorObject.inputData.length - 1] : null;
      // search configuration mapping if layer is configured
      return (!this.showMap && lastInputData) ? this.layerNameMapping.hasOwnProperty(lastInputData) : false; // eslint-disable-line
    },
  },
  mounted() {
    this.mounted = true;
    this.init();
  },
  methods: {
    async init() {
      await this.checkMultipleTabCompare();
      this.selectedSensorTab = this.multipleTabCompare
        ? this.multipleTabCompare.features
          .indexOf(this.multipleTabCompare.features
            .find((s) => this.getLocationCode(s.properties.indicatorObject)
              === this.$route.query.poi))
        : 0;
    },
    async checkMultipleTabCompare() {
      let compare;
      const { selectedIndicator } = this.$store.state.indicators;
      const hasGrouping = this.appConfig.featureGrouping && this.appConfig.featureGrouping
        .find((g) => g.features.find((i) => i.includes(this.getLocationCode(selectedIndicator))));
      if (hasGrouping) {
        compare = {};
        compare.label = hasGrouping.label;
        compare.features = hasGrouping.features;
        // Pre-load all indicators to populate tab items
        await Promise.all(compare.features.map(async (f) => {
          const feature = this.$store.state.features.allFeatures
            .find((i) => this.getLocationCode(i.properties.indicatorObject) === f);
          await loadIndicatorData(this.baseConfig, feature.properties.indicatorObject);
        }));
        compare.features = compare.features.map((f) => this.$store.state.features.allFeatures
          .find((i) => this.getLocationCode(i.properties.indicatorObject) === f));
      }
      this.multipleTabCompare = compare;
    },
    swipe() {
      this.overlay = true;
      setTimeout(() => { this.overlay = false; }, 2000);
    },
    scrollToCustomAreaIndicator() {
      this.$vuetify.goTo(this.$refs.customAreaIndicator, { container: document.querySelector('.data-panel') });
    },
  },
  watch: {
    selectedSensorTab(index) {
      if (this.multipleTabCompare.features[index]) {
        const poi = this.getLocationCode(this.multipleTabCompare.features[index]
          .properties.indicatorObject);
        this.$router.replace({ query: { ...this.$route.query, poi } }).catch(() => {});
        this.$store.commit('indicators/CUSTOM_AREA_INDICATOR_LOAD_FINISHED', null);
      }
    },
    dialog(open) {
      if (open && this.$refs.referenceMap) {
        this.$refs.referenceMap.onResize();
        setTimeout(() => {
          this.$refs.referenceMap.flyToBounds();
        }, 200);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
::v-deep .v-slide-group__prev {
  display: none !important;
}
.chart {
  background: #fff;
}
</style>
