var hideRotten = false
,   serverIsServing = true
,   bindElement
,   serverPings = 0
,   use_local_storage = true
,   local_data = [];

// ------------------ ON DOM LOAD ---------------------
$(function() {

    // depending on the page, append the rotten tomatoes info to different elems.
    switch ($('body').attr('id')) {
        case 'page-WiHome':
            bindElement = '.boxShot';
            break;

        case 'page-WiAltGenre':
            bindElement = '.boxShot';
            break;

        case 'page-WiMovie':
            bindElement = '.agMovie';
            break;

        case 'page-RecommendationsHome':
            bindElement = '.agMovie';
            break;

        default:
            bindElement = '.boxShot';
            break;
    }

    renderFilter(); // Adds 'Hide Rotten' button
    computeRatings(); // Initializes Rotten Tomato Ratings
    
    // Click handler for Hide Rotten filter
    $('#rt_filter').find('input').change(function() {
        if ($(this).is(':checked')) {
            hideRotten = true;
        } else {
            hideRotten = false;
        }
    });

    // handle lazy loading of moviesactivated by click on next arrows for Suggested page.
    $('.qSlider-navNext, qSlider-navNext').click(function() {
        computeRatings();
    });
});

chrome.storage.local.get('rotten_data', function(data) {
    if (data.rotten_data) {
        local_data = data.rotten_data
    }
});


// ------------------ Add RT Ratings to Movies ---------------------
function computeRatings() {

    $(bindElement).each(function() {
        var $this = $(this)
        ,   $movieLink = $this.find('a')
        ,   $parentEl = $this.parent()
        ,   $parentElClass = $parentEl.attr('class')
        ,   bindElementTemp = $movieLink.closest(bindElement)
        ,   hit_the_server = true
        ,   RTData = {};


        //only poll rotten tomatoes if the element is on screen
        if ($parentEl.isOnScreen()) {
            
            // If the box shot is small, we need to get the link from the img alt tag instead
            if ($this.hasClass('boxShot-sm')) {
                var movieTitle = $movieLink.find('img').attr('alt');
                var movieUrl = convertTitleToUrl(movieTitle);

            } else {
                var movieTitle = $(this).find('.boxShotImg').attr('alt');
                var movieUrl = convertTitleToUrl(movieTitle);
            }

            //make sure its a movie and hasnt already been polled
            if (!$parentElClass.match('TV') && !$parentEl.hasClass('polled')) {
                if (bindElementTemp.children('.rt_rating').length < 1) {
                    
                    // check to see if we have it in local storage
                    if (use_local_storage) {
                        for (var j = 0; j < local_data.length; j++) {
                            if(_.contains(local_data[j], movieTitle)) {
                                RTData = local_data[j]
                                addRTRatings(bindElementTemp, RTData)
                                hit_the_server = false;
                                break;
                            } 
                        }
                    }

                    if(serverIsServing && hit_the_server) {
                        serverPings += 1;
                        
                        $.getJSON(movieUrl).
                            success(function(data) {
                                if (data.movies && data.movies.length > 0) {
                                    var rating = data.movies[0].ratings.critics_score;
                                    var audience_rating = data.movies[0].ratings.audience_score;
                                    var rtLink = data.movies[0].links.alternate;

                                    RTData = {
                                        'movie': movieTitle,
                                        'rating': rating,
                                        'audience_rating': audience_rating,
                                        'rtLink': rtLink
                                    };

                                    addRTRatings(bindElementTemp, RTData)
                                    serverIsServing = true;
                                } else {
                                    RTData = {
                                        'movie': movieTitle,
                                        'rating': 'n/a',
                                        'audience_rating': 'n/a',
                                    };
                                }

                                if(!_.contains(local_data, movieTitle)) {
                                    local_data.push(RTData);
                                    chrome.storage.local.set({rotten_data: local_data})
                                }
                            }).
                            
                            error(function(error) {
                                console.log(error);
                                console.warn('Server is over quota');
                                serverIsServing = false;
                            })
                        ;
                    }
                }
                $parentEl.addClass('polled');
            }
        };
        hideRottenMovies($parentEl);
    });
    
    setTimeout(function() { computeRatings() }, 3000);
};

function addRTRatings($element, data) {
    var $el = $element
    ,   $movieLink = $el.find('a')
    ,   $parentEl = $el.parent()
    ,   $parentElClass = $parentEl.attr('class')

    var audienceClass = 'na';
    var ratingClass = 'na';

    if (data.rating > 59) {
        ratingClass = 'fresh';
    } else if (data.rating > 0) {
        ratingClass = 'rotten';
    } else if (data.rating ==='n/a') {
        ratingClass = 'na';
    }

    if (data.audience_rating > 59) {
        audienceClass = 'fresh';
    } else if (data.audience_rating > 0) {
        audienceClass = 'rotten';
    } else if (data.audience_rating ==='n/a'){
        audienceClass = 'na';
    } 

    $parentEl.addClass(ratingClass);

    var $ratingEl = $(
        "<a target='_blank' href='" + data.rtLink + "' class='rt_rating'>" +
        "<div class='icon rt_" + ratingClass + "'></div><span class='critics_score " + ratingClass + "''>" + data.rating + "%</span>" +
        "<div class='icon audience rt_" + audienceClass + "'></div><span class='audience_score percent "+audienceClass+"'>" + data.audience_rating + "%</span>" + "</a>"
    );

    if (data.rating !== 'n/a' || data.audience_rating !== 'n/a' )
    $el.append($ratingEl);

    $ratingEl.hide().fadeIn(500);
}


// ------------------ Hide Rotten Movies ---------------------
function renderFilter() {
    var $filterSelect = $('<label id="rt_filter"><input type="checkbox">Hide Rotten Movies</label>');
    $('#global-search-form').prepend($filterSelect);
}

function hideRottenMovies($el) {
    if (hideRotten) {
        if ($el.hasClass('rotten')) {
            $el.fadeOut(500);
        } else if ($el.hasClass('na') && $el.find('.icon.audience').hasClass('rt_rotten')) {
            $el.fadeOut(500);
        }
    } else {
        if (!$el.hasClass('rateable-movie-buffer') &&  $el.hasClass('na') || $el.hasClass('rotten')) {
            $el.fadeIn(500)
        }
    }
}

// ------------------ Sanitation Functions ---------------------
function convertTitleToUrl(title) {
    var rtUrl = "http://netflixrottenizer.appspot.com";
    title = encodeURI(title);
    title = removeSubtitles(title);
    title = replaceAmpersands(title);
    title = removeExtraneousCharacters(title);
    title = title.toLowerCase();
    title = removeLeadingArticle(title);
    title = replaceAccentedLetters(title);
    rtUrl += "?q=" + title + "&page_limit=1";
    return rtUrl;
}

function removeSubtitles(title) {
    return title.replace(/(: Collector's Series|: Collector's Edition|: Director's Cut|: Special Edition)/, "");
}

function replaceAmpersands(title) {
    return title.replace(/&/g, "and");
}

function removeExtraneousCharacters(title) {
    return title.replace(/('|,|\.|!|\?|\/|:|\[|\]|\(|\))/g, "");
}

function removeLeadingArticle(title) {
    return title.replace(/^(the|a|an)_/, "");
}

function replaceAccentedLetters(title) {
    return title.replace(/(é|è)/g, "e");
}

function deSrcHTML(html) {
    return html.replace(/src/g, "foo");
}

function getURLParameter(name, url) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(url) || [, ""])[1].replace(/\+/g, '%20')) || null;
}

// ------------------ isONScreen ---------------------
// Jquery Plugin -- calculates whether an element is currently displayed in the viewport
$.fn.isOnScreen = function() {
    var win = $(window);
    var viewport = {
        top: win.scrollTop(),
        left: win.scrollLeft()
    };

    viewport.right = viewport.left + win.width();
    viewport.bottom = viewport.top + win.height();

    var bounds = this.offset();
    bounds.right = bounds.left + this.outerWidth();
    bounds.bottom = bounds.top + this.outerHeight();

    return (!(viewport.right < bounds.left || viewport.left > bounds.right || viewport.bottom < bounds.top || viewport.top > bounds.bottom));
};

// ------------------ Google Analytics ---------------------
var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-47202933-1']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

