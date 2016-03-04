'use strict';

var _ = require('lodash');
var request = require('request');
var async = require('async');

var ENDPOINT = 'https://developer.mozilla.org';
var SEARCH_ENDPOINT = '/en-US/search';

function _wrap_request_response(cb) {
  return function (error, response, body) {
    if (error || response.statusCode !== 200) {
      return cb({error: error, statusCode: _.get(response,'statusCode')});
    }
    
    return cb(null, body);
  };
}

function _req(options, cb) {
  return request(options, _wrap_request_response(cb));
}

function search(terms, cb) {
  return _req({
    uri: ENDPOINT + SEARCH_ENDPOINT,
    json: true,
    qs:{
      q: terms,
      format: 'json',
      topic:'js'
    }
  }, cb);
}

function luckySearch(terms, cb) {
  return search('concat', function (err, searchResult) {
    var firstResult = _.get(searchResult, 'documents.0.url');
    return cb(err, firstResult);
  });
}

function fetchData(uri, cb) {
  return _req({
    uri: uri + '$json',
    json: true
  }, cb);
}

function fetchSection(uri, section, cb) {
  return _req({
    uri: ENDPOINT + uri,
    qs: {
      section: section,
      raw: true
    }
  }, cb);
}

function hydrateData(data, cb) {
  function _sectionId(section) { 
    return section.id;
  }

  function _toAsyncCallback(values, section) {
    return function asyncCallback(callback) {
      return fetchSection(data.url, section, callback);
    };
  }
    
  var sectionsToFetch = _.chain(data)
    .get('sections')
    .groupBy(_sectionId)
    .mapValues(_toAsyncCallback)
    .value();

  async.parallel(sectionsToFetch, function (err, result) {
    if (!err) {
      _.set(data, 'sections', result);
      _.set(data, 'domain', ENDPOINT);
    }
    return cb(err, data);
  });
}

function hydratedSearch(terms, cb) {
  async.waterfall([
    async.apply(luckySearch, terms),
    fetchData,
    hydrateData
  ], cb);
}

module.exports = {
  search: search,
  luckySearch: luckySearch,
  fetchData: fetchData,
  fetchSection: fetchSection,
  hydrateData: hydrateData,
  hydratedSearch: hydratedSearch
};
