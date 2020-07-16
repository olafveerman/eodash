/* eslint no-shadow: ["error", { "allow": ["state"] }] */
import { Wkt } from 'wicket';
import { latLng } from 'leaflet';
import { DateTime } from 'luxon';
import countriesJson from '@/assets/countries.json';

let globalIdCounter = 0;
const state = {
  allFeatures: [],
  featureFilters: {
    countries: [],
    indicators: [],
  },
  selectedFeatures: [],
  resultsCount: {
    economic: 0,
    agriculture: 0,
    environment: 0,
    health: 0,
  },
};

const getters = {
  getCountries(state) {
    return [...new Set([
      state.allFeatures
        .map((f) => f.properties.indicatorObject.Country),
    ].flat(1))].sort();
  },
  getIndicators(state, _, rootState) {
    const indicators = [...new Set([
      state.allFeatures
        .map((f) => {
          // if no class corresponding to a Indicator code, assume a dummy
          const code = f.properties.indicatorObject['Indicator code'];
          const validClass = typeof rootState.config.baseConfig.indicatorsDefinition[code] !== 'undefined' ? rootState.config.baseConfig.indicatorsDefinition[code].class : rootState.config.baseConfig.indicatorsDefinition.d.class;
          return {
            code,
            indicator: f.properties.indicatorObject.Description,
            validClass,
          };
        }),
    ].flat(2))].sort();
    return indicators;
  },
  getCountryItems(state, gettersG) {
    return gettersG.getCountries
      .filter((c) => c !== 'all')
      .map((c) => {
        const item = countriesJson.features
          .find((f) => f.properties.alpha2 === c);
        return {
          code: c,
          name: item ? item.properties.name : 'Regional',
        };
      })
      .sort((a, b) => ((a.name > b.name) ? 1 : -1));
  },
  getFeatures(state) {
    let features = state.allFeatures;
    if (state.featureFilters.countries.length > 0) {
      features = features
        .filter((f) => {
          if (Array.isArray(f.properties.indicatorObject.Country)) {
            return f.properties.indicatorObject.Country
              .includes(state.featureFilters.countries);
          } else { // eslint-disable-line
            return state.featureFilters.countries
              .includes(f.properties.indicatorObject.Country)
              || f.properties.indicatorObject.City === 'World';
          }
        });
    }
    if (state.featureFilters.indicators.length > 0) {
      features = features
        .filter((f) => state.featureFilters.indicators
          .includes(f.properties.indicatorObject['Indicator code']));
    }
    features = features
      .sort((a, b) => ((a.properties.indicatorObject.Country > b.properties.indicatorObject.Country)
        ? 1 : -1));
    return features;
  },
  getLatestUpdate(state) {
    const times = state.allFeatures.map((f) => {
      let time = f.properties.indicatorObject.Time;
      let latest;
      if (time && time.length > 0) {
        time = time.sort((a, b) => ((a > b) ? 1 : -1));
        latest = time[time.length - 1];
      }
      return latest;
    });
    const filtered = times.filter((t) => !!t).sort((a, b) => ((a > b) ? 1 : -1));
    return filtered[filtered.length - 1];
  },
};

const mutations = {
  // SET_MANUAL_FEATURES(state, features) {
  //   state.allFeatures = state.allFeatures.concat(
  //     features,
  //     this.state.config.baseConfig.globalIndicators,
  //   );
  // },
  ADD_NEW_FEATURES(state, features) {
    state.allFeatures = state.allFeatures.concat(features);
  },
  // SET_ALL_DUMMY_LOCATIONS(state, features) {
  //   state.allFeatures = state.allFeatures.concat(features);
  // },
  INIT_FEATURE_FILTER(state, { countries, indicators }) {
    if (countries) {
      state.featureFilters.countries = countries;
    }
    if (indicators) {
      state.featureFilters.indicators = indicators;
    }
  },
  SET_FEATURE_FILTER(state, { countries, indicators }) {
    if (countries) {
      state.featureFilters.countries = countries;
    }
    if (indicators) {
      state.featureFilters.indicators = indicators;
    }
  },
  SET_SELECTED_FEATURES(state, features) {
    state.selectedFeatures = features;
  },
  ADD_RESULTS_COUNT(state, { type, count }) {
    state.resultsCount[type] += count;
  },
};
const actions = {
  async loadAllCsv({ commit, rootState }) {
    let allFeatures = [];
    // First, load all the CSVs
    const defs = rootState.config.baseConfig.indicatorsDefinition;
    const keys = Object.keys(defs);
    for (let kk = 0; kk < keys.length; kk += 1) {
      if (Object.prototype.hasOwnProperty.call(defs[keys[kk]], 'file') && defs[keys[kk]].file) {
        const csvUrl = defs[keys[kk]].file;
        const F = await this.dispatch('features/loadCsv', csvUrl); // eslint-disable-line
        allFeatures = allFeatures.concat(F);
      }
    }
    // Then, add the hardcoded features
    allFeatures = allFeatures.concat(rootState.config.baseConfig.globalIndicators);
    // Then, if applicable, add the dummy features
    if (rootState.config.appConfig.displayDummyLocations) {
      const dummyFeatures = await this.dispatch('features/loadDummyLocations');
      allFeatures = allFeatures.concat(dummyFeatures);
    }
    commit('ADD_NEW_FEATURES', allFeatures);
  },
  loadCsv({ rootState, commit }, csvUrl) {
    return new Promise((resolve) => {
      this._vm.$papa.parse(csvUrl, {
        download: true,
        quotes: true,
        header: true,
        skipEmptyLines: true,
        delimiter: ',',
        complete: (results) => {
          commit('ADD_RESULTS_COUNT', {
            type: rootState.config.baseConfig.indicatorsDefinition[results.data[0]['Indicator code']].class,
            count: results.data.length, // individual measurements
          });
          if (results.data[0].AOI) { // only continue if AOI column is present
            const wkt = new Wkt();
            // Sort results by time
            results.data.sort((a, b) => (
              DateTime.fromISO(a.Time).diff(DateTime.fromISO(b.Time))
            ));
            /* Aggregate data based on AOI and indicator type */
            const featureObjs = {};
            for (let rr = 0; rr < results.data.length; rr += 1) {
              const uniqueKey = `${results.data[rr].AOI}_${results.data[rr]['Indicator code']}`;
              if (Object.prototype.hasOwnProperty.call(featureObjs, uniqueKey)) {
                featureObjs[uniqueKey]['Indicator Value'].push(
                  results.data[rr]['Indicator Value'],
                );
                const measurement = results.data[rr]['Measurement Value'].replace(',', '.');
                featureObjs[uniqueKey]['Measurement Value'].push(
                  measurement.length !== 0 ? Number(measurement) : NaN,
                );
                featureObjs[uniqueKey]['Reference value'].push(
                  results.data[rr]['Reference value'],
                );
                featureObjs[uniqueKey]['Reference time'].push(
                  DateTime.fromISO(results.data[rr]['Reference time']),
                );
                featureObjs[uniqueKey].Time.push(
                  DateTime.fromISO(results.data[rr].Time),
                );
                featureObjs[uniqueKey]['Color code'].push(
                  results.data[rr]['Color code'],
                );
                featureObjs[uniqueKey]['EO Sensor'].push(
                  results.data[rr]['EO Sensor'],
                );
                featureObjs[uniqueKey]['Input Data'].push(
                  results.data[rr]['Input Data'],
                );
                featureObjs[uniqueKey]['Site Name'].push(
                  results.data[rr]['Site Name'],
                );
                // Add possible additional subaois
                if (Object.prototype.hasOwnProperty.call(
                  featureObjs[uniqueKey]['Sub-AOI'], 'features',
                )) {
                  try {
                    if (featureObjs[uniqueKey]['Sub-AOI'] !== '') {
                      wkt.read(featureObjs[uniqueKey]['Sub-AOI']);
                      const jsonGeom = wkt.toJson();
                      // create feature
                      const ftrs = [{
                        type: 'Feature',
                        properties: {},
                        geometry: jsonGeom,
                      }];
                      featureObjs[uniqueKey]['Sub-AOI'].features.push(ftrs);
                    }
                  } catch (err) {} // eslint-disable-line no-empty
                }
              } else {
                featureObjs[uniqueKey] = results.data[rr];
                featureObjs[uniqueKey]['Indicator Value'] = [
                  featureObjs[uniqueKey]['Indicator Value'],
                ];
                featureObjs[uniqueKey]['Color code'] = [
                  featureObjs[uniqueKey]['Color code'],
                ];
                const measurement = featureObjs[uniqueKey]['Measurement Value'].replace(',', '.');
                featureObjs[uniqueKey]['Measurement Value'] = [
                  measurement.length !== 0 ? Number(measurement) : NaN,
                ];
                featureObjs[uniqueKey]['Reference value'] = [
                  featureObjs[uniqueKey]['Reference value'],
                ];
                featureObjs[uniqueKey].Time = [
                  DateTime.fromISO(featureObjs[uniqueKey].Time),
                ];
                featureObjs[uniqueKey]['Reference time'] = [
                  DateTime.fromISO(featureObjs[uniqueKey]['Reference time']),
                ];
                featureObjs[uniqueKey]['EO Sensor'] = [
                  featureObjs[uniqueKey]['EO Sensor'],
                ];
                featureObjs[uniqueKey]['Input Data'] = [
                  featureObjs[uniqueKey]['Input Data'],
                ];
                featureObjs[uniqueKey]['Site Name'] = [
                  featureObjs[uniqueKey]['Site Name'],
                ];
                // dummy empty geometry
                let ftrs = [];
                try {
                  // assuming sub-aoi does not change over time
                  if (featureObjs[uniqueKey]['Sub-AOI'] !== '') {
                    wkt.read(featureObjs[uniqueKey]['Sub-AOI']);
                    const jsonGeom = wkt.toJson();
                    // create a feature collection
                    ftrs = [{
                      type: 'Feature',
                      properties: {},
                      geometry: jsonGeom,
                    }];
                  }
                } catch (err) {} // eslint-disable-line no-empty
                const ftrCol = {
                  type: 'FeatureCollection',
                  features: ftrs,
                };
                featureObjs[uniqueKey]['Sub-AOI'] = ftrCol;
              }
            }
            const features = [];
            const keys = Object.keys(featureObjs);

            for (let kk = 0; kk < keys.length; kk += 1) {
              const coordinates = keys[kk].split('_')[0].split(',').map(Number);
              // console.log(featureObjs[keys[kk]]);
              featureObjs[keys[kk]].AOI = latLng(coordinates);
              featureObjs[keys[kk]].id = globalIdCounter; // to connect indicator & feature
              features.push({
                latlng: latLng(coordinates),
                id: globalIdCounter,
                properties: {
                  indicatorObject: featureObjs[keys[kk]],
                },
              });
              globalIdCounter += 1;
            }
            resolve(features);
          }
        },
      });
    });
  },
  loadDummyLocations({ rootState }) {
    return new Promise((resolve) => {
      this._vm.$papa.parse(rootState.config.appConfig.displayDummyLocations, {
        download: true,
        quotes: true,
        header: true,
        skipEmptyLines: true,
        delimiter: ',',
        complete: (results) => {
          if (results.data[0].AOI) { // only continue if AOI column is present
            const featureObjs = {};
            for (let rr = 0; rr < results.data.length; rr += 1) {
              const uniqueKey = `${results.data[rr].AOI}_d`;
              featureObjs[uniqueKey] = results.data[rr];
              featureObjs[uniqueKey]['Indicator Value'] = [''];
              featureObjs[uniqueKey].dummy = true;
            }
            const features = [];
            const keys = Object.keys(featureObjs);

            for (let kk = 0; kk < keys.length; kk += 1) {
              const coordinates = keys[kk].split('_')[0].split(',').map(Number);
              featureObjs[keys[kk]].id = globalIdCounter; // to connect indicator & feature
              features.push({
                latlng: latLng(coordinates),
                id: globalIdCounter,
                properties: {
                  indicatorObject: featureObjs[keys[kk]],
                },
              });
              globalIdCounter += 1;
            }
            resolve(features);
          }
        },
      });
    });
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
