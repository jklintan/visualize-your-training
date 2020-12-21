d3.csv("./data/trainingData.csv", function(data) {

  // USER INPUT
  var color;
  var kernelWidth;
  var maxLim;
  var curveType;

  // set the dimensions and margins of the graph
  var margin = {top: 200, right:100, bottom: 300, left:100},
      width = window.innerWidth - 50 - margin.left - margin.right,
      height = 1200 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  var svg = d3.select("#my_dataviz")
    .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("style", "background-color:black")
    .append("g")
      .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");


    /**************** PROCESS TRAINING DATA ***************/
    var trainingEntries = data.length

    var validTrainings = []
    var trainingNumb = 0
    for(i = 0; i < trainingEntries; i++){
      var trainingtime = data[i]['Time']
      if(trainingtime[0] == '0' && trainingtime[1] == '0' && trainingtime[3] == '0' && trainingtime[4] == '0'){ //Inalid training, remove
        // console.log("Invalid")
      }else{
        validTrainings[trainingNumb] = data[i]
        trainingNumb++;
      }
    }

    trainingEntries = validTrainings.length

    // Elevation used to set maximum of density function
    var trainingElevations = []
    for(i = 0; i < trainingEntries; i++){
      var elevation = validTrainings[i]['Elev Gain']
      if(elevation == '--')
        trainingElevations[i] = "0"
      else
        trainingElevations[i] = parseInt(elevation)
    }

    // Training times used to set width of density function
    var trainingTimes = []
    for(i = 0; i < trainingEntries; i++){
      var trainingtime = validTrainings[i]['Time']
      var t = parseInt(trainingtime[0] + trainingtime[1])*60 + parseInt(trainingtime[3] + trainingtime[4]) // Trainingtime in minutes
      trainingTimes[i] = t
    }
    
    // Start times decide where on the x-axis the density function is plotted
    var startTimes = []
    for(i = 0; i < trainingEntries; i++){
      var trainingtimeStart = validTrainings[i]['Date']
      startTimes[i] = trainingtimeStart[11] + trainingtimeStart[12]
      startTimes[i] = parseInt(startTimes[i])
    }

    // Get the time span for x-limits
    var earliestStart = Math.min.apply(Math, startTimes)
    if(earliestStart < 5)
      earliestStart = 5
    var latestStart = Math.max.apply(Math, startTimes)
    var timeSpan = latestStart + 2 - earliestStart - 1


    /******************* CREATE DENSITY DATA TO CREATE DENSITY FUNCTION FROM */
    var trainingPlotData = new Array(trainingEntries)
    var density = new Array(timeSpan)
    var currentHour = 0
    for(i = 0; i < trainingEntries; i++){
      var t = earliestStart - 1;
      for(h = 0; h < timeSpan; h++){
        if(Math.abs((startTimes[i] - (t + h)) < 1 || Math.abs(startTimes[i] + trainingTimes[i]%60 - (t + h)) < 1) && t > 7 && t < 18){
          var rand = randomIntFromInterval(1, trainingElevations[i])
          if(rand > 100)
            rand = 100
          density[h] = rand

        }else if((Math.abs(startTimes[i] - (t + h)) < 2 || Math.abs(startTimes[i] + trainingTimes[i]%60 - (t + h)) < 2)){
          var rand = trainingElevations[i] - 10
          if(rand < 0)
            rand = 10
          density[h] = rand
        }else if((Math.abs(startTimes[i] - (t + h)) < 3  || Math.abs(startTimes[i] + trainingTimes[i]%60 - (t + h)) < 3) && t > 6){
          var rand = trainingElevations[i] - 20
          if(rand < 0)
            rand = 5
          density[h] = rand
        }else
          density[h] = 0
      }
      trainingPlotData[i] = density
      density = new Array(timeSpan)  
    }


    /***************** PLOT *****************/

    // Add X axis
    var x = d3.scaleLinear()
      .domain([earliestStart - 1, latestStart + 2])
      .range([ 0, width]);

    // Create a Y scale for densities
    var y = d3.scaleLinear()
      .domain([0, 1.6])
      .range([ height, 0]);

    // Compute kernel density estimation for each column:
    var kde = kernelDensityEstimator(kernelEpanechnikov(0.4), x.ticks(timeSpan)) // TODO : Kernel input should be user driven
    var allDensity = []
    var trainingDensity = []
    var densityData = transpose(trainingPlotData)
    var key = 1
    for (i = 0; i < trainingPlotData.length; i++) {
        density = kde(densityData.map(function(d){  
          return d[i]}) )
        if(density[0][1] != 0 && density[1][1] == 0)
          density[0][1] = 0
        if(density[density.length - 1][1] != 0 && density[density.length - 2][1] == 0)
          density[density.length - 1][1] = 0

        var allZero = true
        for(k = 0; k < density.length; k++){
          if(density[k][1] != 0)
            allZero = false
        }

        if(!allZero){
          allDensity.push({key: key, density: density})
          key++;
        }
    }

    // console.log(allDensity)

    // Add areas
    svg.selectAll("areas")
      .data(allDensity)
      .enter()
      .append("path")
        .attr("transform", function(d){
          return("translate(0," + (10*d.key - height + 10) +")" )})
        .datum(function(d){return(d.density)})
        .attr("fill", "#000")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .attr("d",  d3.line()
            .curve(d3.curveCardinal)
            .x(function(d) { return x(d[0]); })
            .y(function(d) { return y(d[1]); })
        )

  });


  /************ UTILITY FUNCTIONS ************/

  // Kernel density functions
  function kernelDensityEstimator(kernel, X) {
    return function(V) {
      return X.map(function(x) {
        return [x, d3.mean(V, function(v) { return kernel(x - v ); })];
      });
    };
  }

  function kernelEpanechnikov(k) {
    return function(v) {
      return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
    };
  }

  function transpose(a) {
    return Object.keys(a[0]).map(function(c) {
        return a.map(function(r) { return r[c]; });
    });
  } 

  function randomIntFromInterval(min, max) { 
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
