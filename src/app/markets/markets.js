angular.module( 'ripplecharts.markets', [
  'ui.state',
  'ui.bootstrap',
  'ui.route'
])

.config(function config( $stateProvider ) {
  $stateProvider
  .state('markets', {
    url: '/markets',
    views: {
      'main': {
        controller: 'MarketsCtrl',
        templateUrl: 'markets/markets.tpl.html'
      }
    },
    data:{ pageTitle: 'Live Chart' },
  }).state('markets.pair', {
    url: '/:base/:counter?interval&range&type&start&end',
    data:{ pageTitle: 'Live Chart' }
  });
})

.controller( 'MarketsCtrl', function MarketsCtrl( $scope, $state, $location) {

  var intervalList = [
    {name: '5m',  interval:'minute',  multiple:5 },
    {name: '15m', interval:'minute',  multiple:15 },
    {name: '30m', interval:'minute',  multiple:30 },
    {name: '1h',  interval:'hour',    multiple:1 },
    {name: '2h',  interval:'hour',    multiple:2 },
    {name: '4h',  interval:'hour',    multiple:4 },
    {name: '1d',  interval:'day',     multiple:1 }
  ];

  var rangeList = [
    {name: '12h', interval:'5m',  offset: function(d) { return d3.time.hour.offset(d, -12); }},
    {name: '1d',  interval:'15m', offset: function(d) { return d3.time.day.offset(d, -1); }},
    {name: '3d',  interval:'30m', offset: function(d) { return d3.time.day.offset(d, -3); }},
    {name: '1w',  interval:'1h',  offset: function(d) { return d3.time.day.offset(d, -7); }},
    {name: '2w',  interval:'2h',  offset: function(d) { return d3.time.day.offset(d, -14); }},
    {name: '1m',  interval:'4h',  offset: function(d) { return d3.time.month.offset(d, -1); }}
  ];

  var dateFormat = 'YYYY-MM-DD';
  var updateMode = '';

  $scope.$watch(function() {
    return $location.url();
  }, setParams);

  $scope.$watchCollection('base', handleTransition.bind(undefined, 'pair'));
  $scope.$watchCollection('counter', handleTransition.bind(undefined, 'pair'));
  $scope.$watch('interval', handleTransition.bind(undefined, 'chart'));
  $scope.$watch('range', handleTransition.bind(undefined, 'chart'));
  $scope.$watch('start', handleTransition.bind(undefined, 'chart'));
  $scope.$watch('end', handleTransition.bind(undefined, 'chart'));
  $scope.$watch('chartType', handleTransition.bind(undefined, 'type'));

  /**
   * handleTransition
   * refresh url with updated params
   */

  function handleTransition(mode, d) {
    updateMode = mode;

    if ($scope.base && $scope.counter) {
      $state.transitionTo('markets.pair', {
        base: $scope.base.currency +
          ($scope.base.issuer ? ':' + $scope.base.issuer : ''),
        counter: $scope.counter.currency +
          ($scope.counter.issuer ? ':' + $scope.counter.issuer : ''),
        interval: $scope.interval,
        range: $scope.range,
        type: $scope.chartType,
        start: $scope.range === 'custom' ? $scope.start : undefined,
        end: $scope.range === 'custom' ? $scope.end : undefined
      });

    } else {
      $state.transitionTo('markets');
    }
  }

  /**
   * setParams
   * set params from url, storage, or defaults
   */

  function setParams(url) {
    //console.log(url, updateMode);

    if ($state.params.base && $state.params.counter) {
      $scope.base = $state.params.base.split(/[+|\.|:]/);
      $scope.base = {
        currency: $scope.base[0],
        issuer: $scope.base[1] ? $scope.base[1]:''
      };

      $scope.counter = $state.params.counter.split(/[+|\.|:]/);
      $scope.counter = {
        currency: $scope.counter[0],
        issuer: $scope.counter[1] ? $scope.counter[1]:''
      };

    } else {
      $scope.base = store.session.get('base') ||
        store.get('base') ||
        Options.base ||
        { currency: 'XRP' };

      $scope.counter = store.session.get('counter') ||
        store.get('counter') ||
        Options.counter ||
        { currency:'USD', issuer:'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B' };
    }


    $scope.range = $state.params.range ||
      store.session.get('range') ||
      store.get('range') ||
      Options.range  ||
      '3d';


    $scope.chartType = $state.params.type ||
      store.session.get('chartType') ||
      store.get('chartType') ||
      Options.chartType ||
      'line';

    $scope.interval = $state.params.interval ||
      store.session.get('interval') ||
      store.get('interval') ||
      Options.interval  ||
      '30m';

    $scope.start = $state.params.start ||
      store.session.get('start') ||
      store.get('start');

    $scope.end = $state.params.end ||
      store.session.get('end') ||
      store.get('end');

    $('#end')
    .datepicker('setDate', $scope.end ? utcDate($scope.end) : utcDate(undefined, 1))
    .css('display', $scope.range === 'custom' ? 'inline-block' :'none')
    .blur();

    $('#start')
    .datepicker('setDate', utcDate($scope.start))
    .css('display', $scope.range === 'custom' ? 'inline-block' :'none')
    .blur();

    // validate range
    if (!getRange()) {
      updateScopeAndStore('range', '1d');
    }

    // validate interval
    if (!getInterval()) {
      updateScopeAndStore('interval', '5m');
    }

    // validate start time
    if ($scope.start &&
      !moment.utc($scope.start, dateFormat).isValid()) {
      updateScopeAndStore('range', '1d');
      updateScopeAndStore('start', undefined);
    }

    // validate end time
    if ($scope.end &&
      !moment.utc($scope.end, dateFormat).isValid()) {
      updateScopeAndStore('range', '1d');
      updateScopeAndStore('end', undefined);
    }

    // validate chart type
    if ($scope.chartType !== 'line' &&
       $scope.chartType !== 'candlestick') {
      updateScopeAndStore('chartType', 'candlestick');
    }

    // check if current interval is valid
    // with the given range
    if (isDisabledInterval()) {
      var range = getRange();
      var interval = range.name === 'custom' ?
        getCustomInterval() : range.interval;

      updateScopeAndStore('interval', interval);
    }

    chartType.classed('selected', function(d) {
      return d === $scope.chartType;
    });

    intervals
    .classed('disabled', isDisabledInterval)
    .classed('selected', function(d) {
      return d.name === $scope.interval;
    });

    ranges.classed('selected', function(d) {
      return d.name === $scope.range;
    });

    // change chart type only
    if (updateMode === 'type') {
      priceChart.setType($scope.chartType);

    // change chart parameters
    } else if (updateMode === 'chart') {
      updateChart();

    // update pair and chart
    } else {
      loadPair();
    }

    updateMode = ''; // reset
  }

  // set up the range selector
  var ranges = d3.select('#range').selectAll('span')
  .data(rangeList)
  .enter().append('span')
  .text(function(d) {
    return d.name;
  })
  .on('click', function(d) {
    var that = this;
    var start;
    var end;

    ranges.classed('selected', function(d) {
        return this === that;
    });

    if (d.name === 'custom') {
      $('#start').show();
      $('#end').show();
      start = moment.utc($('#start').val()).format(dateFormat);
      end = moment.utc($('#end').val()).format(dateFormat);
      updateScopeAndStore('start', start, true);
      updateScopeAndStore('end', end, true);
      updateScopeAndStore('interval', getCustomInterval(), true);

    } else {
      $('#start').hide();
      $('#end').hide();
      if (isDisabledInterval(null, null, d)) {
        updateScopeAndStore('interval', d.interval, true);
      }
    }

    updateScopeAndStore('range', d.name);
  });

  // set up the interval selector
  var intervals = d3.select('#interval')
  .selectAll('span')
  .data(intervalList)
  .enter().append('span')
  .text(function(d) {
    return d.name;
  })
  .on('click', function(d) {
    if (!isDisabledInterval(d)) {
      updateScopeAndStore('interval', d.name);
    }
  });

  // set up the chart type selector
  var chartType = d3.select('#chartType')
  .attr('class','selectList')
  .selectAll('span')
  .data(['line', 'candlestick'])
  .enter().append('span')
  .attr('class', function(d) {
    return d + 'Graphic';
  })
  .attr('title', function(d) {
    return d + ' mode';
  })
  .text(function(d) {
    return d;
  })
  .on('click', function(d) {
    updateScopeAndStore('chartType', d);
  });

// set up the price chart
  var priceChart = new PriceChart ({
    id     : 'priceChart',
    url    : API,
    type   : $scope.chartType,
    live   : true,
    resize : true
  });

  var book = new OrderBook ({
    chartID: 'bookChart',
    tableID: 'bookTables',
    remote: remote,
    resize: true,
    emit: function(type, data) {
      if (type === 'spread') {
        document.title = data.bid + '/' +
          data.ask + ' ' +
          $scope.base.currency + '/' +
          $scope.counter.currency;
      }
    }
  });

//set up trades feed
  var tradeFeed = new TradeFeed({
    id: 'tradeFeed',
    url: API
  });

  var toCSV = d3.select('#toCSV');

  toCSV.on('click', function(){
    if (toCSV.attr('disabled')) return;
    var data = priceChart.getRawData();
    var list = [];

    for (var i=0; i<data.length; i++) {
      list.push(JSON.parse(JSON.stringify(data[i])));
    }

    var csv = jsonToCSV(list);
    if (!!Modernizr.prefixed('requestFileSystem', window)) {
      var blob  = new Blob([csv], {'type':'application/octet-stream'});
      this.href = window.URL.createObjectURL(blob);
    } else {
      this.href = 'data:text/csv;charset=utf-8,' + escape(csv);
    }

    this.download = $scope.base.currency+'_'+$scope.counter.currency+'_historical.csv';
    this.target   = '_blank';
  });

  priceChart.onStateChange = function(state) {
    if (state=='loaded') toCSV.style('opacity',1).attr('disabled',null);
    else toCSV.style('opacity',0.3).attr('disabled',true);
  };

  /**
   * utcDate
   */

  function utcDate(str, offset) {
    var date = moment.utc(str || undefined, dateFormat);
    var d;

    if (offset) {
      date.add(offset, 'day');
    }

    d = new Date(date);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d;
  }

  /**
   * isDisabledInterval
   */

  function isDisabledInterval(interval, index, range) {
    var start;
    var end;
    var diff;
    var num;

    if (!interval) {
      interval = getInterval();
    }

    if (!range) {
      range = getRange();
    }

    if (range.name === 'custom') {
      start = moment.utc($scope.start);
      end = moment.utc($scope.end);
    } else {
      end = moment.utc();
      start = range.offset(end);
    }

    diff = Math.abs(moment.utc(start).diff(end)) / 1000;

    switch(interval.name) {
      case '5m':
        num = diff/(300);
        break;
      case '15m':
        num = diff/(900);
        break;
      case '30m':
        num = diff/(1800);
        break;
      case '1h':
        num = diff/(3600);
        break;
      case '2h':
        num = diff/(7200);
        break;
      case '4h':
        num = diff/(14400);
        break;
      case '1d':
        num = diff/(86400);
        break;
      case '3d':
        num = diff/(259200);
        break;
      case '7d':
        num = diff/(604800);
        break;
      case '1M':
        if (diff >= 31500000){
          num = 100;
        }
        else num = 0;
        break;
      default:
        return true;
    }

    return num <= 25 || num >= 366
  }

  /**
   * getCustomInterval
   */

  function getCustomInterval() {
    var diff = moment.utc($scope.end)
    .diff(moment.utc($scope.start), 'minutes') / 144;
    var interval;

    if (diff < 5) {
      interval = '5m';
    } else if (diff < 15) {
      interval = '15m';
    } else if (diff < 30) {
      interval = '30m';
    } else if (diff < 60) {
      interval = '1h';
    } else if (diff < 60 * 2) {
      interval = '2h';
    } else if (diff < 60 * 4) {
      interval = '4h';
    } else if (diff < 60 * 24) {
      interval = '1d';
    } else if (diff < 60 * 24 * 3) {
      interval = '3d';
    } else if (diff < 60 * 24 * 7) {
      interval = '7d';
    } else {
      interval = '1M';
    }

    return interval;
  }

  /**
   * updateScopeAndStore
   */

  function updateScopeAndStore(key, value, ignore) {
    if (value === undefined) {
      delete $scope[key];
      store.remove(key);
      store.session.remove(key);

    } else {
      $scope[key] = value;
      store.set(key, value);
      store.session.set(key, value);
    }

    if (!ignore && !$scope.$$phase) {
      $scope.$apply();
    }
  }

  /**
   * getInterval
   */

  function getInterval(name) {
    if (!name) {
      name = $scope.interval;
    }

    for (var i=0; i<intervalList.length; i++) {
      if (intervalList[i].name === name) {
        return intervalList[i];
      }
    }
  }

  /**
   * getRange
   */

  function getRange(name) {
    if (!name) {
      name = $scope.range;
    }

    for (var i=0; i<rangeList.length; i++) {
      if (rangeList[i].name === name) {
        return rangeList[i];
      }
    }
  }

  /**
   * updateChart
   * update chart options
   */

  function updateChart() {
    var interval = getInterval();
    var range = getRange();

    var options = {
      interval: interval.interval,
      multiple: interval.multiple,
      offset: range.offset
    }

    if ($scope.range === 'custom') {
      options.live = false;
      options.start = $scope.start;
      options.end = $scope.end;

    } else {
      options.live = true;
    }

    priceChart.load($scope.base, $scope.counter, options);
    priceChart.setType($scope.chartType);
  }

  /**
   * loadPair
   * load/change currency pair
   */

  function loadPair() {
    updateChart();
    book.getMarket($scope.base, $scope.counter);
    tradeFeed.loadPair ($scope.base, $scope.counter);
  }

  // reload data when coming back online
  $scope.$watch('online', function(online) {
    if (online) {
      loadPair();
    }
  });

  // stop the listeners when leaving page
  $scope.$on('$destroy', function(){
    priceChart.suspend();
    book.suspend();
    tradeFeed.suspend();
  });
});
