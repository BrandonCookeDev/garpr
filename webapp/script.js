var app = angular.module('app', ['ngRoute', 'ui.bootstrap', 'angulartics', 'angulartics.google.analytics', 'facebook']);

app.directive('onReadFile', function ($parse) {
    return {
        restrict: 'A',
        scope: false,
        link: function(scope, element, attrs) {
            var fn = $parse(attrs.onReadFile);

            element.on('change', function(onChangeEvent) {
                var reader = new FileReader();

                reader.onload = function(onLoadEvent) {
                    scope.$apply(function() {
                        fn(scope, {$fileContent:onLoadEvent.target.result});
                    });
                };

                reader.readAsText((onChangeEvent.srcElement || onChangeEvent.target).files[0]);
            });
        }
    };
});

app.service('RegionService', function ($http, PlayerService, TournamentService, RankingsService, MergeService, SessionService) {
    var service = {
        regionsPromise: $http.get(hostname + 'regions'),
        regions: [],
        region: '',
        setRegion: function (newRegionId) {
            if (!this.region || newRegionId != this.region.id) {
                this.regionsPromise.then(function(response) {
                    service.region = service.getRegionFromRegionId(newRegionId);
                    PlayerService.playerList = null;
                    TournamentService.tournamentList = null;
                    RankingsService.rankingsList = null;
                    MergeService.mergeList = null;
                    service.populateDataForCurrentRegion();
                });
            }
        },
        getRegionFromRegionId: function(regionId) {
            return this.regions.filter(function(element) {
                return element.id == regionId;
            })[0];
        },
        getRegionDisplayNameFromRegionId: function(regionId) {
            var region = this.getRegionFromRegionId(regionId);
            if(region!=null){
                return region.display_name;
            }else{
                return "Invalid Region";
            }
        },
        populateDataForCurrentRegion: function() {
            // get all players instead of just players in region
            var curRegion = this.region;
            $http.get(hostname + this.region.id + '/players?all=true').
                success(function(data) {
                    PlayerService.allPlayerList = data;

                    // filter players for this region
                    PlayerService.playerList = {
                        'players': data.players.filter(
                            function(player){
                                return player.regions.some(
                                    function(region){
                                        if(region==null) return false;
                                        return region === curRegion.id;
                                    });
                            })
                    };
                });

            SessionService.authenticatedGet(hostname + this.region.id + '/tournaments?includePending=true',
                function(data) {
                    TournamentService.tournamentList = data.tournaments.reverse();
                });

            $http.get(hostname + this.region.id + '/rankings').
                success(function(data) {
                    RankingsService.rankingsList = data;
                });

            SessionService.authenticatedGet(hostname + this.region.id + '/merges',
                function(data) {
                    MergeService.mergeList = data;
                });
        }
    };

    service.regionsPromise.success(function(data) {
        service.regions = data.regions;
    });

    service.display_regions = [{"id": "newjersey", "display_name": "New Jersey"},
                               {"id": "nyc", "display_name": "NYC Metro Area"},
                               {"id": "chicago", "display_name": "Chicago"},
                               {"id": "georgia", "display_name": "Georgia"},
                               {"id": "northcarolina", "display_name": "North Carolina"},
                               {"id": "southcarolina", "display_name": "South Carolina"},
                               {"id": "alabama", "display_name": "Alabama"},
                               {"id": "li", "display_name": "Long Island"}];

    return service;
});

app.service('PlayerService', function($http) {
    var service = {
        playerList: null,
        allPlayerList:null,
        getPlayerIdFromName: function (name) {
            for (i = 0; i < this.playerList.players.length; i++) {
                p = this.playerList.players[i]
                if (p.name == name) {
                    return p.id;
                }
            }
            return null;
        },
        // local port of _player_matches_query from backend
        // now returns matchQuality instead of just a boolean
        // if match_quality > 0, consider it a match
        playerMatchesQuery: function(player, query) {
            var playerName = player.name.toLowerCase();
            var query = query.toLowerCase();

            if(playerName === query){
                return 10;
            }

            var rex = /\.|\|| /;
            var tokens = playerName.split(rex);
            for(var i=0;i<tokens.length;i++){
                var token = tokens[i];
                if(token.length > 0){
                    if(token.startsWith(query)){
                        return 5;
                    }
                }
            }

            if(query.length >= 3 && playerName.includes(query)){
                return 1;
            }

            // no match
            return 0;
        },
        getPlayerListFromQuery: function(query, filter_fn) {
            var TYPEAHEAD_PLAYER_LIMIT = 20;
            var filteredPlayers = [];
            for (var i = 0; i < this.allPlayerList.players.length; i++) {
                var curPlayer = this.allPlayerList.players[i];

                if(filter_fn == null || filter_fn(curPlayer)){
                    var matchQuality = this.playerMatchesQuery(curPlayer, query);
                    if(matchQuality > 0){
                        filteredPlayers.push({'player': curPlayer,
                                              'quality': matchQuality});
                    }
                }
            }

            filteredPlayers.sort(function(p1, p2){
                if(p1.quality < p2.quality) return 1;
                else if(p1.quality > p2.quality) return -1;
                else return 0;
            });

            filteredPlayers = filteredPlayers.slice(0, TYPEAHEAD_PLAYER_LIMIT);

            filteredPlayers = filteredPlayers.map(p => p.player);

            return filteredPlayers;

            // let's not send so many get requests
            /*
            url = hostname + defaultRegion + '/players';
            params = {
                params: {
                    query: query
                }
            }

            return $http.get(url, params).then(function(response) {
                players = response.data.players;
                if (filter_fn != undefined) {
                    filtered_players = []
                    for (var i = 0; i < players.length; i++) {
                        if (filter_fn(players[i])) {
                            filtered_players.push(players[i])
                        }
                    }
                    players = filtered_players;
                }
                return players;
            });*/
        }
    };
    return service;
});

app.service('MergeService', function($http) {
    var service = {
        mergeList: null
    };
    return service;
});

app.service('TournamentService', function() {
    var service = {
        tournamentList: null
    };
    return service;
});

app.service('RankingsService', function() {
    var service = {
        rankingsList: null
    };
    return service;
});

app.service('SessionService', function($http) {
    var service ={
        loggedIn: false,
        userInfo: null,
        authenticatedGet: function(url, successCallback) {
            config = {
                "headers": {
                    "withCredentials": true,
                    "Access-Control-Allow-Credentials": true
                }
            };
            $http.get(url, config).success(successCallback)
        },
        authenticatedPost: function(url, data, successCallback, failureCallback) {
            config = {
                "headers": {
                    "withCredentials": true,
                    "Access-Control-Allow-Credentials": true
                }
            };
            $http.post(url, data, config).success(successCallback).error(failureCallback);
        },
        authenticatedPut: function(url, data, successCallback, failureCallback) {
            if (data === undefined) {
                data = {};
            }
            config = {
                "headers": {
                    "withCredentials": true,
                    "Access-Control-Allow-Credentials": true
                }
            };
            if (failureCallback === undefined) {
                failureCallback = function(data) {}
            }
            $http.put(url, data, config).success(successCallback).error(failureCallback);
        },
        authenticatedDelete: function(url, successCallback) {
            config = {
                "headers": {
                    "withCredentials": true,
                    "Access-Control-Allow-Credentials": true
                }
            };
            $http.delete(url, config).success(successCallback);
        },
        isAdmin: function() {
            if (!this.loggedIn) {
                return false;
            }
            else {
                return this.userInfo.admin_regions.length > 0
            }
        },
        isAdminForRegion: function(regionId) {
            if (!this.loggedIn) {
                return false;
            }
            else {
                return this.userInfo.admin_regions.indexOf(regionId) > -1;
            }
        },
        getAdminRegions: function() {
            return this.userInfo.admin_regions
        }
    };

    return service;
});

app.config(function ($httpProvider) {
    $httpProvider.defaults.withCredentials = true;
    $httpProvider.defaults.useXDomain = true;
    $httpProvider.defaults.headers.common = 'Content-Type: application/json';
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
    //rest of route code
});

app.config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/:region/rankings', {
        templateUrl: 'rankings/views/rankings.html',
        controller: 'RankingsController',
        activeTab: 'rankings'
    }).
    when('/:region/players', {
        templateUrl: 'players/views/players.html',
        controller: 'PlayersController',
        activeTab: 'players'
    }).
    when('/:region/players/:playerId', {
        templateUrl: 'players/views/player_detail.html',
        controller: 'PlayerDetailController',
        activeTab: 'players'
    }).
    when('/:region/tournaments', {
        templateUrl: 'tournaments/views/tournaments.html',
        controller: 'TournamentsController',
        activeTab: 'tournaments'
    }).
    when('/:region/tournaments/:tournamentId', {
        templateUrl: 'tournaments/views/tournament_detail.html',
        controller: 'TournamentDetailController',
        activeTab: 'tournaments'
    }).
    when('/:region/merges', {
        templateUrl: 'players/views/merges.html',
        controller: 'MergesController',
        activeTab: 'tournaments'
    }).
    when('/:region/headtohead', {
        templateUrl: 'head_to_head/views/headtohead.html',
        controller: 'HeadToHeadController',
        activeTab: 'headtohead'
    }).
    when('/:region/seed', {
        templateUrl: 'tools/seed_tournament/seed.html',
        controller: 'SeedController',
        activeTab: 'seed'
    }).
    when('/about', {
        templateUrl: 'common/about/about.html',
        activeTab: 'about'
    }).
    when('/adminfunctions',{
        templateUrl: 'tools/admin_functions/admin_functions.html',
        controller: 'AdminFunctionsController'
    }).
    otherwise({
        redirectTo: '/' + defaultRegion + '/rankings'
    });
}]);

app.controller("AdminFunctionsController", function($scope, $http, RegionService, SessionService){
    var url = hostname + "adminfunctions";
    $scope.regionService = RegionService;
    $scope.sessionService = SessionService;

    $scope.regions = []
    $http.get(hostname + 'regions').
        success(function(data) {
            data.regions.forEach(function(region){
                $scope.regions.push(region);
            });
        });

    $scope.regionStatusMessage = "";
    $scope.userStatusMessage = "";

    $scope.foo = null;
    $scope.postParams = {
        function_type: '',
        new_region: '',
        new_user_name: '',
        new_user_pass: '',
        new_user_permissions: '',
        new_user_regions: []
    };

    $scope.addRegion = function(region){
        if(!$scope.postParams.new_user_regions.includes(region))
            $scope.postParams.new_user_regions.push(region);
    };

    $scope.removeRegion = function(region){
        if($scope.postParams.new_user_regions.includes(region))
            $scope.postParams.new_user_regions.splice($scope.postParams.new_user_regions.indexOf(region), 1);
    };

    $scope.checkRegionBox = function(region){
        var display_name = region.display_name;
        var checkboxId = display_name + "_checkbox";
        var checkbox = document.getElementById(checkboxId);
        if(checkbox.checked){
            $scope.addRegion(region.id);
        }
        else{
            $scope.removeRegion(region.id);
        }
    };

    $scope.submitNewUser = function(){
        if($scope.postParams.new_user_name == null ||
            $scope.postParams.new_user_pass == null){
            return;
        }
        $scope.postParams.function_type = 'user';

        //TODO HTTP CALL TO API
        $scope.sessionService.authenticatedPut(url, $scope.postParams, $scope.putUserSuccess, $scope.putUserFailure);
    };

    $scope.submitNewRegion = function(){
        if($scope.postParams.new_region == null){
            return;
        }
        $scope.postParams.function_type = 'region';

        //TODO HTTP CALL TO API
        $scope.sessionService.authenticatedPut(url, $scope.postParams, $scope.putRegionSuccess, $scope.putRegionFailure);
    };

    $scope.putRegionSuccess = function(response, status, headers, bleh){
        console.log(response);
        $scope.regionStatusMessage = "Region " + $scope.postParams.new_region + " successfully inserted!";
        document.getElementById('regionStatusMessage').innerHTML
            = "Region " + $scope.postParams.new_region + " successfully inserted!";

        var form = document.getElementById('newRegionForm');
        resetForm(form);
    };

    $scope.putUserSuccess = function(response, status, headers, bleh){
        console.log(response);
        $scope.userStatusMessage = "User " + $scope.postParams.new_user_name + " successfully inserted!";
        document.getElementById('userStatusMessage').innerHTML
            = "User " + $scope.postParams.new_user_name + " successfully inserted!";

        var form = document.getElementById('newUserForm');
        resetForm(form);
    };

    $scope.putRegionFailure = function(response, status, headers, bleh){
        console.log(response);
        $scope.regionStatusMessage = "An error occurred in inserting user."
        document.getElementById('regionStatusMessage').innerHTML = "An error occurred in inserting region.";
    };

    $scope.putUserFailure = function(response, status, headers, bleh){
        console.log(response);
        $scope.userStatusMessage = "An error occurred in inserting user."
        document.getElementById('userStatusMessage').innerHTML = "An error occurred in inserting user.";
    };
});

app.controller("AuthenticationController", function($scope, $modal, Facebook, SessionService, RegionService) {
    $scope.sessionService = SessionService;
    $scope.regionService = RegionService;
    $scope.postParams = {};
    $scope.errorTxt = "";

    $scope.handleAuthResponse = function(response, status, headers, bleh) {
        if (response.status == 'connected') {
            $scope.errorTxt = "";
            $scope.getSessionInfo(function() {
                $scope.closeLoginModal();
            });
        }
        else {
            $scope.sessionService.loggedIn = false;
            $scope.sessionService.userInfo = null;
            $scope.errorTxt = "Login Failed";
        }
    };

    $scope.getSessionInfo = function(callback) {
        $scope.sessionService.authenticatedGet(hostname + 'users/session',
            function(data) {
                $scope.sessionService.loggedIn = true;
                $scope.sessionService.userInfo = data;
                $scope.regionService.populateDataForCurrentRegion();
                if (callback) { callback(); }
            }
        );
    }

    $scope.closeLoginModal = function() {
        $scope.modalInstance.close()
    };

    $scope.openLoginModal = function() {
        $scope.modalInstance = $modal.open({
            templateUrl: 'common/login/login_modal.html',
            scope: $scope,
            size: 'lg'
        });
    };

    $scope.login = function() {
        url = hostname + 'users/session'
        $scope.sessionService.authenticatedPut(url, $scope.postParams, $scope.handleAuthResponse, $scope.handleAuthResponse);
    };

    $scope.logout = function() {
        url = hostname + 'users/session'
        $scope.sessionService.authenticatedDelete(url, $scope.handleAuthResponse, $scope.postParams,
            $scope.handleAuthResponse);
    };

    // Initial login
    $scope.getSessionInfo();
});

app.controller("NavbarController", function($scope, $route, $location, RegionService, PlayerService) {
    $scope.regionService = RegionService;
    $scope.playerService = PlayerService;
    $scope.$route = $route;

    $scope.selectedPlayer = null;

    $scope.playerSelected = function($item) {
        $location.path($scope.regionService.region.id + '/players/' + $item.id);
        $scope.selectedPlayer = null;
    };
});

app.controller("RankingsController", function($scope, $routeParams, $modal, RegionService, RankingsService, SessionService) {
    RegionService.setRegion($routeParams.region);
    $scope.regionService = RegionService;
    $scope.rankingsService = RankingsService
    $scope.sessionService = SessionService

    $scope.modalInstance = null;
    $scope.disableButtons = false;

    $scope.prompt = function() {
        $scope.modalInstance = $modal.open({
            templateUrl: 'generate_rankings_prompt_modal.html',
            scope: $scope,
            size: 'lg'
        });
    };

    $scope.confirm = function() {
        $scope.disableButtons = true;
        url = hostname + $routeParams.region + '/rankings';
        successCallback = function(data) {
            $scope.rankingsService.rankingsList = data;
            $scope.modalInstance.close();
        };

        $scope.sessionService.authenticatedPost(url, {}, successCallback, angular.noop);
    };

    $scope.cancel = function() {
        $scope.modalInstance.close();
    };
});

app.controller("TournamentsController", function($scope, $http, $routeParams, $modal, RegionService, TournamentService, SessionService) {
    RegionService.setRegion($routeParams.region);
    $scope.regionService = RegionService;
    $scope.tournamentService = TournamentService;
    $scope.sessionService = SessionService;

    $scope.modalInstance = null;
    $scope.disableButtons = false;
    $scope.errorMessage = false;

    $scope.smashGG_brackets = [];
    $scope.postParams = {};
    $scope.included_phases = [];

    $scope.smashGGImportMessage = "";

    $scope.open = function() {
        $scope.disableButtons = false;
        $scope.modalInstance = $modal.open({
            templateUrl: 'tournaments/views/import_tournament_modal.html',
            scope: $scope,
            size: 'lg'
        });

        //Handle if modal is closed or dismissed
        $scope.modalInstance.result.then(function(){
            $scope.clearSmashGGData();
        }, function(){
            $scope.clearSmashGGData();
        });
    };

    $scope.setBracketType = function(bracketType) {
        $scope.postParams = {};
        $scope.postParams.type = bracketType;
        $scope.errorMessage = false;
    };

    $scope.close = function() {
        $scope.clearSmashGGData();
        $scope.modalInstance.close();
    };

    $scope.clearSmashGGData = function(){
        $scope.smashGG_brackets = [];
        $scope.included_phases = [];
        $scope.smashGGImportMessage.innerHTML = "";

    };

    $scope.submit = function() {
        $scope.disableButtons = true;
        $scope.postParams.included_phases = $scope.included_phases;

        url = hostname + $routeParams.region + '/tournaments';
        successCallback = function(data) {
            // TODO don't need to populate everything, just tournaments
            $scope.regionService.populateDataForCurrentRegion()
            $scope.close();
        };

        failureCallback = function(data) {
            $scope.disableButtons = false;
            $scope.errorMessage = true;
        };

        $scope.sessionService.authenticatedPost(url, $scope.postParams, successCallback, failureCallback);
        document.getElementById('smashGGImportMessage').innerHTML = "";
    };

    $scope.loadFile = function(fileContents) {
        $scope.postParams.data = fileContents;
    };

    $scope.openDeleteTournamentModal = function(tournamentId) {
        $scope.modalInstance = $modal.open({
            templateUrl: 'delete_tournament_modal.html',
            scope: $scope,
            size: 'lg'
        });
    $scope.tournamentId = tournamentId;
    };

    $scope.deleteTournament = function() {
        url = hostname + $routeParams.region + '/tournaments/' + $scope.tournamentId;
        successCallback = function(data) {
            window.location.reload();
        };
        $scope.sessionService.authenticatedDelete(url, successCallback);
    };


    $scope.checkSmashggBracket = function(bracket){
        var id = bracket.id;
        var checkboxId = id + "_checkbox";
        var checkbox = document.getElementById(checkboxId);
        if(checkbox.checked){
            //CHECKED: INCLUDE PHASE ID FOR INCLUSION
            if(!$scope.included_phases.includes(id))
                $scope.included_phases.push(id);
        }
        else{
            // NOT CHECKED: DON'T INCLUDE PHASE ID IN POST REQUEST
            if($scope.included_phases.includes(id))
                $scope.included_phases.splice($scope.included_phases.indexOf(id), 1);
        }
    }


    //RETRIEVE THE PHASE ID TO BRACKET NAME MAP
    $scope.smashGG_populateBrackets = function(){
        $scope.disableButtons = true;
        if($scope.postParams.data === ''){
            $scope.smashGG_brackets = [];
            document.getElementById('smashGGImportMessage').innerHTML = "";
            return;
        }else{
            document.getElementById('smashGGImportMessage').innerHTML = "Importing Phases. Please wait...";
        }

        var url = hostname + 'smashGgMap';
        $http.get( url, {
            params: {
                bracket_url: $scope.postParams.data
            }
        }).
        success(function(data) {
            for(var key in data){
                var bracket = {
                    name: data[key],
                    id: key
                };
                $scope.smashGG_brackets.push(bracket);
            };
            $scope.disableButtons = false;
            document.getElementById('smashGGImportMessage').innerHTML = "Please choose the phases to include";
        });
    };
});

app.controller("TournamentDetailController", function($scope, $routeParams, $http, $modal, RegionService, SessionService, PlayerService) {
    RegionService.setRegion($routeParams.region);
    $scope.regionService = RegionService;
    $scope.sessionService = SessionService;
    $scope.playerService = PlayerService;

    $scope.modalInstance = null;
    $scope.disableButtons = false;
    $scope.errorMessage = false;

    $scope.tournament = null;
    $scope.tournamentId = $routeParams.tournamentId
    $scope.isPendingTournament = false;
    $scope.aliasMap = {};
    $scope.playerData = {};
    $scope.playerCheckboxState = {};

    $scope.matchCheckbox = null;

    $scope.openDetailsModal = function() {
        $scope.modalInstance = $modal.open({
            templateUrl: 'tournaments/views/tournament_details_modal.html',
            scope: $scope,
            size: 'lg'
        });
        $scope.postParams = {name: $scope.tournament.name,
                             date: $scope.tournament.date,
                             pending: $scope.isPendingTournament};
        $scope.tournamentRegionCheckbox = {};

        $scope.sessionService.getAdminRegions().forEach(
            function(regionId){
                if($scope.isTournamentInRegion(regionId)){
                    $scope.tournamentRegionCheckbox[regionId] = "IN_REGION";
                }else{
                    $scope.tournamentRegionCheckbox[regionId] = "NOT_IN_REGION";
                }
            });

        $scope.disableButtons = false;
        $scope.errorMessage = false;
    };

    $scope.closeDetailsModal = function() {
        $scope.modalInstance.close()
    };

    $scope.updateTournamentDetails = function() {
        url = hostname + $routeParams.region + '/tournaments/' + $scope.tournamentId;
        $scope.disableButtons = true;

        tournamentInRegion = function(regionId){
            return $scope.tournamentRegionCheckbox[regionId]!=="NOT_IN_REGION";
        };

        $scope.postParams['regions'] = $scope.sessionService.getAdminRegions().filter(tournamentInRegion);

        successCallback = function(data) {
            $scope.tournament = data;
            $scope.closeDetailsModal();
        };

        failureCallback = function(data) {
            $scope.disableButtons = false;
            $scope.errorMessage = true;
        };

        $scope.sessionService.authenticatedPut(url, $scope.postParams, successCallback, failureCallback);

        return;
    };

    $scope.openSubmitPendingTournamentModal = function() {
        $scope.modalInstance = $modal.open({
            templateUrl: 'submit_pending_tournament_confirmation_modal.html',
            scope: $scope,
            size: 'lg'
        });
    };

    $scope.closeSubmitPendingTournamentModal = function() {
        $scope.modalInstance.close()
    };

    $scope.submitPendingTournament = function() {
        $scope.putTournamentFromUI();
        url = hostname + $routeParams.region + '/tournaments/' + $scope.tournamentId + '/finalize';
        successCallback = function(data) {
            window.location.reload();
        };
        $scope.sessionService.authenticatedPost(url, {}, successCallback);
    };

    $scope.isTournamentInRegion = function(regionId) {
        return $scope.tournament.regions.indexOf(regionId) > -1
    };

    $scope.onPlayerCheckboxChange = function(playerAlias) {
        $scope.playerData[playerAlias] = null;
    };

    $scope.playerSelected = function(playerAlias, $item) {
        $scope.playerCheckboxState[playerAlias] = false;
    };

    $scope.prettyPrintRegionListForPlayer = function(player) {
        var retString = 'None';
        if (player != null && player.hasOwnProperty('regions')) {
            var regions = player.regions;
            for (i = 0; i < regions.length; i++) {
                r = regions[i];
                if (retString == 'None') {
                    retString = $scope.regionService.getRegionDisplayNameFromRegionId(r);
                }
                else {
                    retString += ', ' + $scope.regionService.getRegionDisplayNameFromRegionId(r);
                }
            }
        }

        return retString;
    };

    $scope.updateAliasMapFromUI = function() {
        var aliasMap = {}
        for (var player in $scope.playerCheckboxState) {
            if ($scope.playerCheckboxState[player] === true) {
                aliasMap[player] = null;
                delete $scope.playerData[player];
            }
        }
        for (var player in $scope.playerData){
            aliasMap[player] = $scope.playerData[player].id
        }
        $scope.aliasMap = aliasMap;
    };

    $scope.putTournamentFromUI = function() {
        $scope.updateAliasMapFromUI();

        // listify the current alias_to_id_map so angular
        // does not strip certain properties
        $scope.tournament.alias_to_id_map = [];
        for(var alias in $scope.aliasMap){
            var id = $scope.aliasMap[alias];
            $scope.tournament.alias_to_id_map.push(
                { "player_alias": alias,
                  "player_id": id
                });
        }

        url = hostname + $routeParams.region + '/pending_tournaments/' + $scope.tournamentId;
        $scope.sessionService.authenticatedPut(url, $scope.tournament, $scope.updateData);
    }

    $scope.updateData = function(data) {
        $scope.tournament = data;
        if ($scope.tournament.hasOwnProperty('alias_to_id_map')) {
            $scope.isPendingTournament = true;

            // load individual player detail
            $scope.tournament.alias_to_id_map.forEach(
                function(aliasItem){
                    var player = aliasItem["player_alias"];
                    var id = aliasItem["player_id"];
                    $scope.aliasMap[player] = id;
                    if(id != null){
                        $scope.playerCheckboxState[player] = false;

                        // TODO: this generates tons of requests. we should be
                        // able to do this with one giant request.
                        $http.get(hostname + $routeParams.region + '/players/' + id).
                            success(function(data) {
                                $scope.playerData[player] = data;
                            });

                    }else{
                        $scope.playerCheckboxState[player] = true;
                    }
                });
        }
    }
    // TODO submission checks! check to make sure everything in $scope.playerData is an object (not a string. string = partially typed box)

    $scope.isMatchCurrentlyExcluded = function(match){
        var excluded = match.excluded;

        if(excluded){
            //var htmlId = 'exclude_set_checkbox_' + match.match_id;
            var winnerHtmlId = 'winner_' + match.match_id;
            var loserHtmlId = 'loser_' + match.match_id;

            //var matchCheckbox = document.getElementById(htmlId);
            var winnerElement = document.getElementById(winnerHtmlId);
            var loserElement = document.getElementById(loserHtmlId);

            winnerElement.className = 'excludedSet';
            loserElement.className = 'excludedSet';
        }

        return excluded;
    }

    $scope.changeMatchExclusion = function(match){
        var htmlId = 'exclude_set_checkbox_' + match.match_id;
        var winnerHtmlId = 'winner_' + match.match_id;
        var loserHtmlId = 'loser_' + match.match_id;

        var matchCheckbox = document.getElementById(htmlId);
        var winnerElement = document.getElementById(winnerHtmlId);
        var loserElement = document.getElementById(loserHtmlId);

        postParams = {
            tournament_id : $scope.tournamentId,
            match_id : match.match_id,
            excluded_tf : matchCheckbox.checked
        }

        url = hostname + $routeParams.region + '/tournaments/' + $scope.tournamentId + '/excludeMatch';

        if(matchCheckbox.checked){
            //API CALL HERE
            $scope.sessionService.authenticatedPost(url, postParams,
                (data) => {
                    // TODO gray out the row
                    winnerElement.className = 'excludedSet';
                    loserElement.className = 'excludedSet';
                    return false;
               },
                () => {
                    excludeFailure();
                    matchCheckbox.checked = false;
               });
        }
        else{
            // API CALL HERE
            $scope.sessionService.authenticatedPost(url, postParams,
                (data) => {
                    // TODO ungray the row
                    winnerElement.className = 'success';
                    loserElement.className = 'danger';
                    alert('Match Included Successfully!');
                    return false;
                },
                () => {
                    excludeFailure();
                    matchCheckbox.checked = true;
               });
        }
    };

    function excludeFailure(){
        alert('Failure to exclude set. Please try again');
    };

    $scope.swapWinnerLoser = function(match){
        if( confirm('Are you sure you want to swap ' + match.winner_name + ' (W) with ' + match.loser_name + ' (L)?' )){
            var winnerHtmlId = 'winner_' + match.match_id;
            var loserHtmlId = 'loser_' + match.match_id;

            var winnerElement = document.getElementById(winnerHtmlId);
            var loserElement = document.getElementById(loserHtmlId);

            var winnerAnchor = winnerElement.getElementsByTagName('a');
            var winnerLink = winnerAnchor[0].href;
            var loserAnchor = loserElement.getElementsByTagName('a');
            var loserLink = loserAnchor[0].href;

            var postParams = {
                tournament_id : $scope.tournamentId,
                match_id : match.match_id
            }
            url = hostname + $routeParams.region + '/tournaments/' + $scope.tournamentId + '/swapWinnerLoser';

            $scope.sessionService.authenticatedPost(url, postParams,
                (data) => {
                    // TODO simply switch the names in the Winner-Loser boxes
                    winnerAnchor[0].innerHTML = match.loser_name;
                    winnerAnchor[0].href = loserLink;

                    loserAnchor[0].innerHTML = match.winner_name;
                    loserAnchor[0].href = winnerLink;

                    alert('Swap was successful! (If people did not swap on table, please refresh the page)');
                    return;
                },
                (err) => {
                    // TODO alert of a failure and exit
                    alert('Failed to swap Winner-Loser');
                    return;
               });
        }

    };

    $http.get(hostname + $routeParams.region + '/tournaments/' + $scope.tournamentId).
        success($scope.updateData);
});

app.controller("PlayersController", function($scope, $routeParams, RegionService, PlayerService) {
    RegionService.setRegion($routeParams.region);
    $scope.regionService = RegionService;
    $scope.playerService = PlayerService;
});

app.controller("PlayerDetailController", function($scope, $http, $routeParams, $modal, RegionService, SessionService, PlayerService) {
    RegionService.setRegion($routeParams.region);
    $scope.regionService = RegionService;
    $scope.sessionService = SessionService;
    $scope.playerService = PlayerService;

    $scope.modalInstance = null;
    $scope.disableButtons = false;
    $scope.errorMessage = false;

    $scope.player = null;
    $scope.playerId = $routeParams.playerId;
    $scope.mergePlayer = "";
    $scope.matches = null;

    $scope.matchStatus = 'L';

    $scope.determineMatchStatus = function(match){
        var status = '';
        status = match.result == 'win' ? "W" : "L";
        if(match.result === 'excluded')
            status = 'EX';
        return status;
    }

    $scope.openDetailsModal = function() {
        $scope.modalInstance = $modal.open({
            templateUrl: 'players/views/player_details_modal.html',
            scope: $scope,
            size: 'lg'
        });

        $scope.postParams = {name: $scope.player.name}
        $scope.playerRegionCheckbox = {}

        $scope.sessionService.getAdminRegions().forEach(
            function(regionId){
                if($scope.isPlayerInRegion(regionId)){
                    $scope.playerRegionCheckbox[regionId] = "IN_REGION";
                }else{
                    $scope.playerRegionCheckbox[regionId] = "NOT_IN_REGION";
                }
            });

        $scope.disableButtons = false;
        $scope.errorMessage = false;
    };

    $scope.closeDetailsModal = function() {
        $scope.modalInstance.close()
    };

    $scope.updatePlayerDetails = function() {
        url = hostname + $routeParams.region + '/players/' + $scope.playerId;
        $scope.disableButtons = true;

        playerInRegion = function(regionId){
            return $scope.playerRegionCheckbox[regionId]!=="NOT_IN_REGION";
        };

        $scope.postParams['regions'] = $scope.sessionService.getAdminRegions().filter(playerInRegion);

        successCallback = function(data) {
            $scope.player = data;
            $scope.closeDetailsModal();
        };

        failureCallback = function(data) {
            $scope.disableButtons = false;
            $scope.errorMessage = true;
        };

        $scope.sessionService.authenticatedPut(url, $scope.postParams, successCallback, failureCallback);

        return;
    };

    $scope.isPlayerInRegion = function(regionId) {
        return $scope.player.regions.indexOf(regionId) > -1
    };

    $scope.submitMerge = function() {
        if ($scope.mergePlayer.id === undefined) {
            alert("You must select a player to merge");
            return;
        }
        url = hostname + $routeParams.region + '/merges';
        params = {"source_player_id": $scope.playerId, "target_player_id": $scope.mergePlayer.id};

        successCallback = function(data) {
            alert("These two accounts have been merged.");
            window.location.reload();
        };

        failureCallback = function(data) {
            alert("Your merge didn't go through. Please check that both players are in the region you administrate and try again later.");
        };
        $scope.sessionService.authenticatedPut(url, params,
            successCallback,
            failureCallback);
    };

    $scope.getMergePlayers = function(viewValue) {
        players = $scope.playerService.getPlayerListFromQuery(viewValue,
            function(player) {return player.id != $scope.playerId});
        return players;
    }

    $http.get(hostname + $routeParams.region + '/players/' + $routeParams.playerId).
        success(function(data) {
            $scope.player = data;
            if($scope.player.merged){
                $http.get(hostname + $routeParams.region + '/players/' + $scope.player.merge_parent).
                    success(function(data) {
                        $scope.mergeParent = data;
                    });
            }
        });

    $http.get(hostname + $routeParams.region + '/matches/' + $routeParams.playerId).
        success(function(data) {
            $scope.matches = data.matches.reverse();
        });

});

app.controller("MergesController", function($scope, $routeParams, $modal, RegionService, MergeService, SessionService) {
    RegionService.setRegion($routeParams.region);
    $scope.regionService = RegionService;
    $scope.mergeService = MergeService;
    $scope.sessionService = SessionService;

    $scope.undoMerge = function(mergeID) {
        url = hostname + $routeParams.region + '/merges/' + mergeID;

        successCallback = function(data) {
            alert("The accounts have successfully been unmerged.");
            window.location.reload();
        };

        $scope.sessionService.authenticatedDelete(url, successCallback);
    };
});

app.controller("HeadToHeadController", function($scope, $http, $routeParams, RegionService, PlayerService) {
    RegionService.setRegion($routeParams.region);
    $scope.regionService = RegionService;
    $scope.playerService = PlayerService;
    $scope.player1 = null;
    $scope.player2 = null;
    $scope.wins = 0;
    $scope.losses = 0;

    $scope.onChange = function() {
        if ($scope.player1 != null && $scope.player2 != null) {
            $http.get(hostname + $routeParams.region +
                '/matches/' + $scope.player1.id + '?opponent=' + $scope.player2.id).
                success(function(data) {
                    $scope.playerName = $scope.player1.name;
                    $scope.opponentName = $scope.player2.name;
                    $scope.matches = data.matches.reverse();
                    $scope.wins = data.wins;
                    $scope.losses = data.losses;
                });
        }
    };

    $scope.determineMatchStatus = function(match, playerName, opponentName){
        var status = '';
        status = match.result == 'win' ? playerName : opponentName;
        if(match.result === 'excluded')
            status = 'MATCH EXCLUDED';
        return status;
    }
});



/**
Adopted from Yuvaraj Tana's implementation @codepen.io : https://codepen.io/YuvarajTana/pen/yNoNdZ/
**/
app.directive('exportToCsv',function(){
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var el = element[0];
            element.bind('click', function(e){
                var table = document.getElementById("seed_table");
                var csvString = '';
                for(var i=1; i<table.rows.length;i++){
                    var rowData = table.rows[i].cells;
                    for(var j=1; j<3;j++){
                        csvString = csvString + rowData[j].innerHTML.trim() + ",";
                    }
                    csvString = csvString.substring(0,csvString.length - 1);
                    csvString = csvString + "\n";
                }
                csvString = csvString.substring(0, csvString.length - 1);
                var a = $('<a/>', {
                    style:'display:none',
                    href:'data:application/octet-stream;base64,'+btoa(csvString),
                    download: scope.tournament_name+'_seeding.csv'
                }).appendTo('body')
                a[0].click()
                a.remove();
            });
        }
    }
});

app.controller("SeedController", function($scope, $http, $routeParams, $modal,SessionService, RegionService, PlayerService, RankingsService) {
    RegionService.setRegion($routeParams.region);
    $scope.regionService = RegionService;
    $scope.playerService = PlayerService;
    $scope.rankingsService = RankingsService;
    $scope.sessionService = SessionService;

    $scope.seeding = {
        players:[]
    };

    $scope.addPlayerRow = function()
    {
        $scope.seeding.players.push(
        {
            seed: $scope.seeding.players.length+1,
            tag : "",
            new : true
        });
    }

    $scope.playerSelected = function(player, item)
    {
        /**
        -1: no rating
        0: current in-region rating
        1: inactive, in-region rating
        2: OOR rating (active/inactive)
        **/
        player.ratingType=-1;
        player.regions = item.regions;
        player.tag = item.name;
        player.rating = undefined;
        player.id = item.id;
        player.new = false;
        $scope.rankingsService.rankingsList.ranking.forEach(function(rank)
        {
            if(rank.name == item.name)
            {
                player.rating = rank.rating;
                player.ratingType = 0;
            }
        });

        //use inactive/OOR ranking if available
        if(player.ratingType==-1)
        {
            
            if(item.ratings !== undefined)
            {
                //inactive
                if($scope.rankingsService.rankingsList.region in item.ratings)
                {
                    var ratingObj = item.ratings[$scope.rankingsService.rankingsList.region];
                    player.rating = ratingObj.mu - 3*ratingObj.sigma;
                    player.ratingType=1;
                }
                //OOR
                else
                {
                    for (var first in item.ratings) break;//this is whack
                    if(first !== undefined){
                        player.rating = item.ratings[first].mu;
                        player.oorRanking = first;
                        player.ratingType = 2;
                    }
                }
            }
        }

        $scope.resortSeeding();
    }

    $scope.prompt = function() {
        $scope.modalInstance = $modal.open({
            templateUrl: 'tools/seed_tournament/import_tournament_modal_challonge_only.html',
            scope: $scope,
            size: 'lg'
        });
    };

    $scope.resortSeeding = function()
    {
        $scope.seeding.players.sort(function(a, b) {
            if(b.rating === undefined)
                return -1;
            else if (a.rating === undefined)
                return 1;
            else
                return b.rating - a.rating;
        });
        $scope.seeding.players.forEach(function(player, index)
        {
            player.seed = index + 1;
        });
    }

     $scope.prettyPrintRegionListForPlayer = function(player) {
        var retString = 'None';
        if (player != null && player.hasOwnProperty('regions')) {
            var regions = player.regions;
            for (i = 0; i < regions.length; i++) {
                r = regions[i];
                if (retString == 'None') {
                    retString = $scope.regionService.getRegionDisplayNameFromRegionId(r);
                }
                else {
                    retString += ', ' + $scope.regionService.getRegionDisplayNameFromRegionId(r);
                }
            }
        }

        return retString;
    };







    $scope.open = function() {
        $scope.disableButtons = false;
        $scope.modalInstance = $modal.open({
            templateUrl: 'import_tournament_modal_challonge_only.html',
            scope: $scope,
            size: 'lg'
        });
    };

    $scope.setBracketType = function(bracketType) {
        $scope.postParams = {};
        $scope.postParams.type = bracketType;
        $scope.errorMessage = false;
    };

    $scope.close = function() {
        $scope.modalInstance.close();
    };


    $scope.submit = function() {
        console.log($scope.postParams);
        $scope.disableButtons = true;

        url = hostname + $routeParams.region + '/tournamentseed';
        successCallback = function(data) {
            data.players.forEach(function(player){
            var players = $scope.playerService.getPlayerListFromQuery(player);
            if(players.length > 0)
            {
                $scope.seeding.players.push({'seed':$scope.seeding.players.length, 'tag':""});
                $scope.playerSelected($scope.seeding.players[$scope.seeding.players.length-1], players[0]);
            }
            else
                $scope.seeding.players.push({'seed':$scope.seeding.players.length, 'tag':player, new:true});
           });
            $scope.tournament_name = data.name;
            $scope.close();
        };

        failureCallback = function(data) {
            $scope.disableButtons = false;
            $scope.errorMessage = true;
        };

        $scope.sessionService.authenticatedPost(url, $scope.postParams, successCallback, failureCallback);
    };


     $scope.loadFile = function(fileContents) {
        $scope.postParams.data = fileContents;
    };

    $scope.openDeleteTournamentModal = function(tournamentId) {
        $scope.modalInstance = $modal.open({
            templateUrl: 'delete_tournament_modal.html',
            scope: $scope,
            size: 'lg'
        });
    $scope.tournamentId = tournamentId;
    };

    $scope.isNewPlayer = function(player)
    {
        return player.rating === undefined;
    }

    $scope.setPlayerNew = function(player)
    {
        
        if(player.new)
            player.rating = undefined;

        $scope.resortSeeding();
    }

    $scope.removePlayer = function(seed)
    {
        $scope.seeding.players.splice(seed-1,1);
        $scope.resortSeeding();
    }

    $scope.close = function(){
        $scope.modalInstance.close();
    }
});

function resetForm(form) {
    // clearing inputs
    var inputs = form.getElementsByTagName('input');
    for (var i = 0; i<inputs.length; i++) {
        switch (inputs[i].type) {
            // case 'hidden':
            case 'text':
                inputs[i].value = '';
                break;
            case 'radio':
            case 'checkbox':
                inputs[i].checked = false;
        }
    }

    // clearing selects
    var selects = form.getElementsByTagName('select');
    for (var i = 0; i<selects.length; i++)
        selects[i].selectedIndex = 0;

    // clearing textarea
    var text= form.getElementsByTagName('textarea');
    for (var i = 0; i<text.length; i++)
        text[i].innerHTML= '';

    var pword = form.getElementsByTagName('password');
    for (var i = 0; i<text.length; i++)
        text[i].innerHTML= '';

    return false;
};

function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
