angular.module('app.tournaments').service('TournamentService', function() {
    var service = {
        tournamentList: null,
        excludedList: null
    };
    return service;
});