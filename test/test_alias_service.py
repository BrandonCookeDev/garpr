import unittest
import alias_service
from mock import patch, Mock
import mongomock
from ConfigParser import ConfigParser
from dao import Dao
from model import *
import json
from bson.objectid import ObjectId
from pymongo import MongoClient

DATABASE_NAME = 'garpr_test'
CONFIG_LOCATION = 'config/config.ini'


class TestAliasService(unittest.TestCase):
    @classmethod
    def setUpClass(self):
        config = ConfigParser()
        config.read(CONFIG_LOCATION)
        username = config.get('database', 'user')
        host = config.get('database', 'host')
        auth_db = config.get('database', 'auth_db')
        password = config.get('database', 'password')
        self.mongo_client = MongoClient(host='mongodb://%s:%s@%s/%s' % (username, password, host, auth_db))
        self.mongo_client.drop_database(DATABASE_NAME)

    def setUp(self):
        self.maxDiff = None

        self.player_1_id = ObjectId()
        self.player_2_id = ObjectId()
        self.player_3_id = ObjectId()
        self.player_4_id = ObjectId()
        self.player_5_id = ObjectId()
        self.player_1 = Player(
                name='gaR',
                aliases=['gar', 'garr'],
                ratings={'norcal': Rating(), 'texas': Rating()},
                regions=['norcal', 'texas'],
                id=self.player_1_id)
        self.player_2 = Player(
                name='sfat',
                aliases=['sfat', 'miom | sfat'],
                ratings={'norcal': Rating()},
                regions=['norcal'],
                id=self.player_2_id)
        self.player_3 = Player(
                name='mango',
                aliases=['mango', 'gar'],
                ratings={'norcal': Rating(mu=2, sigma=3)},
                regions=['socal'],
                id=self.player_3_id)
        self.player_4 = Player(
                name='garpr|gar',
                aliases=['garpr|gar'],
                ratings={'norcal': Rating(mu=2, sigma=3)},
                regions=['norcal'],
                id=self.player_4_id)

        self.players = [self.player_1,
                        self.player_2,
                        self.player_3,
                        self.player_4]

        self.user_id_1 = 'abc123'
        self.user_admin_regions_1 = ['norcal']
        self.username1 = 'Full Name'
        #    def __init__(self, id, admin_regions, username, salt, hashed_password):
        self.user_1 = User(id=self.user_id_1,
                           admin_regions=self.user_admin_regions_1,
                           username=self.username1,
                           salt='nacl',
                           hashed_password='browns')

        self.users = [self.user_1]

        self.region_1 = Region(id='norcal', display_name='Norcal')
        Dao.insert_region(self.region_1,
                          self.mongo_client,
                          database_name=DATABASE_NAME)
        self.norcal_dao = Dao('norcal',
                              self.mongo_client,
                              database_name=DATABASE_NAME)

        for player in self.players:
            self.norcal_dao.insert_player(player)

    def tearDown(self):
        self.mongo_client.drop_database(DATABASE_NAME)

    def test_get_player_suggestions_from_player_aliases(self):
        self.assertEquals(alias_service.get_player_suggestions_from_player_aliases(self.norcal_dao, ['gar', 'garpr | gar', 'g a r r']),
            {
                "gar": [self.player_1, self.player_3],
                "garpr | gar": [self.player_1, self.player_3, self.player_4],
                "g a r r": [self.player_1]
            })

    def test_get_player_or_suggestions_from_player_aliases(self):
        self.assertEquals(alias_service.get_player_or_suggestions_from_player_aliases(self.norcal_dao, ['gar', 'garpr | gar', 'g a r r']),
            {
                "gar": {
                    "player": self.player_1,
                    "suggestions": [self.player_1, self.player_3]
                },
                "garpr | gar": {
                    "player": None,
                    "suggestions": [self.player_1,
                                    self.player_3,
                                    self.player_4],
                },
                "g a r r": {
                    "player": None,
                    "suggestions": [self.player_1]
                }
            })

    def test_get_top_suggestion_for_aliases(self):
        suggestions = alias_service.get_top_suggestion_for_aliases(
                                    self.norcal_dao, ['gar', 'garpr | gar'])
        expected_suggestions = {
            "gar": self.player_1,
            "garpr | gar": self.player_1,
        }

        self.assertEquals(suggestions, expected_suggestions)

    def test_get_top_suggestion_for_aliases_none(self):
        suggestions = alias_service.get_top_suggestion_for_aliases(self.norcal_dao, ['gar', 'garpr | gar', 'ASDFASDF'])
        expected_suggestions = {
            "gar": self.player_1,
            "garpr | gar": self.player_1,
            "ASDFASDF": None
        }

        self.assertEquals(suggestions, expected_suggestions)

    def test_get_alias_to_id_map_in_list_format(self):
        suggestions = alias_service.get_alias_to_id_map_in_list_format(
                self.norcal_dao, ['gar', 'garpr | gar', 'ASDFASDF'])
        expected_suggestions = [
            AliasMapping(player_alias="gar", player_id=self.player_1.id),
            AliasMapping(player_alias="garpr | gar", player_id=self.player_1.id),
            AliasMapping(player_alias="ASDFASDF", player_id=None)
        ]

        self.assertEquals(len(suggestions), 3)
        self.assertTrue(expected_suggestions[0] in suggestions)
        self.assertTrue(expected_suggestions[1] in suggestions)
        self.assertTrue(expected_suggestions[2] in suggestions)
