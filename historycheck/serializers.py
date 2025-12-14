from rest_framework import serializers
from .models import HistoryPerson, HistoryCheckOrder, HistoryCheckOrderItem
from collections import OrderedDict
from django.contrib.auth.models import User

class HistoryPersonSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = HistoryPerson
        fields = ['id', 'person_name', 'year_from', 'year_to', 'description', 'image', 'is_active']
        read_only_fields = ['id', 'image']

    def get_image(self, obj):
        return obj.image if obj.image else None


class HistoryCheckOrderItemSerializer(serializers.ModelSerializer):
    person_detail = HistoryPersonSerializer(source='person', read_only=True)

    class Meta:
        model = HistoryCheckOrderItem
        fields = [
            'id',
            'person_detail',
            'percent_of_trust',
        ]
        read_only_fields = ['id', 'person_detail']

    def update(self, instance, validated_data):
        validated_data.pop('historyperson', None)
        return super().update(instance, validated_data)

class HistoryCheckOrderSerializer(serializers.ModelSerializer):
    items = HistoryCheckOrderItemSerializer(many=True, read_only=True)
    creator = serializers.CharField(source='creator.username', read_only=True)
    moderator = serializers.CharField(source='moderator.username', read_only=True)

    class Meta:
        model = HistoryCheckOrder
        fields = [
            'id',
            'creator',
            'moderator',
            'history_text',
            'status',
            'created_at',
            'formed_at',
            'completed_at',
            'year_from_result',
            'year_to_result',
            'items'
        ]
        read_only_fields = [
            'id',
            'creator',
            'moderator',
            'status',
            'created_at',
            'formed_at',
            'completed_at'
        ]

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'email', 'first_name', 'last_name']

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name']


class UserLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()