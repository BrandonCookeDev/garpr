angular.module('app.rankings').controller("RankingsController", function($scope, $http, $routeParams, $modal, RegionService, RankingsService, SessionService) {
    RegionService.setRegion($routeParams.region);
    $scope.regionService = RegionService;
    $scope.rankingsService = RankingsService
    $scope.sessionService = SessionService

    $scope.modalInstance = null;
    $scope.disableButtons = false;

    $scope.rankingNumDaysBack = 0;
    $scope.rankingsNumTourneysAttended = 0;

    $scope.tourneyNumDaysBack = null;
    $scope.tourneyDaysBackStartDate = null;

    $scope.tourneyRangeStartDate = null;
    $scope.tourneyRangeEndDate = null;

    $scope.prompt = function() {
        $scope.modalInstance = $modal.open({
            templateUrl: 'app/rankings/views/generate_rankings_prompt_modal.html',
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

        var postParams = {
            ranking_num_tourneys_attended: $scope.rankingsNumTourneysAttended,
            ranking_activity_day_limit: $scope.rankingNumDaysBack,
            tournament_qualified_day_limit: $scope.tourneyNumDaysBack
        }

        $scope.sessionService.authenticatedPost(url, postParams, successCallback, angular.noop);
    };

    $scope.cancel = function() {
        $scope.modalInstance.close();
    };

    $scope.getNumberDaysBack = function(){
        $scope.clearTournamentRange();

        var startDate = new Date($scope.tourneyDaysBackStartDate);
        $scope.tourneyNumDaysBack = $scope.rankingsService.calculateDaysSince(startDate);
    }

    $scope.clearNumDaysBack = function(){
        $scope.tourneyNumDaysBack = null;
        $scope.tourneyDaysBackStartDate = null;
    }

    $scope.clearTournamentRange = function(){
        $scope.tourneyRangeStartDate = null;
        $scope.tourneyRangeEndDate = null;
    }

    $scope.getRegionRankingCriteria = function(){
        url = hostname + $routeParams.region + '/rankings';
        $http.get(url)
        .then(
        (res) => {
            $scope.rankingNumDaysBack = res.data.ranking_criteria.ranking_activity_day_limit;
            $scope.rankingsNumTourneysAttended = res.data.ranking_criteria.ranking_num_tourneys_attended;
            $scope.tourneyNumDaysBack = res.data.ranking_criteria.tournament_qualified_day_limit;
        },
        (err) => {
            alert('There was an error getting the Ranking Criteria for the region')
        });

    }

    $scope.saveTournamentQualificationCriteria = function(){
        url = hostname + $routeParams.region + '/rankings';
        var putParams = {
            type: 'tournament',
            tournament_qualified_day_limit: $scope.tourneyNumDaysBack,
            tournament_qualified_start_date: $scope.tourneyRangeStartDate,
            tournament_qualified_end_date: $scope.tourneyRangeEndDate
        }

        $scope.sessionService.authenticatedPut(url, putParams,
             (res) => {
                alert('Successfully updated Region: ' + $routeParams.region + ' Tournament Qualification Criteria.');
            },
            (err) => {
                alert('There was an error updating the Tournament Qualification Criteria. Please try again.');
            });
    }

    $scope.saveRegionRankingsCriteria = function(){
        url = hostname + $routeParams.region + '/rankings';
        var putParams = {
            type: 'ranking',
            ranking_num_tourneys_attended: $scope.rankingsNumTourneysAttended,
            ranking_activity_day_limit: $scope.rankingNumDaysBack,
            tournament_qualified_day_limit: $scope.tourneyNumDaysBack
        }

        $scope.sessionService.authenticatedPut(url, putParams,
        (res) => {
            alert('Successfully updated Region: ' + $routeParams.region + ' Ranking Criteria.');
        },
        (err) => {
            alert('There was an error updating the Region Ranking Criteria. Please try again.');
        });
    };

    var rankingCriteria = $scope.getRegionRankingCriteria()
});