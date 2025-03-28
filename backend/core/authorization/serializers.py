from rest_framework import serializers
from home.models import *
from home.serialzers import *
from django.contrib.auth.models import User

class userSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'
class hospitalSerializer(serializers.ModelSerializer):
    user = userSerializer()
    class Meta:
        model = hospital
        fields = '__all__'
class hospitalLedgerSerializer(serializers.ModelSerializer):
    hospital = hospitalSerializer()
    class Meta:
        model = hospitalLedger
        fields = '__all__'
class HospitalDocumentSerializer(serializers.ModelSerializer):
    hospitalLedger = hospitalLedgerSerializer()
    class Meta:
        model = hospitalDocument
        fields = '__all__'


class patientSerializer(serializers.ModelSerializer):
    user = userSerializer()
    class Meta:
        model = patient
        fields = '__all__'
class PatientDocumentSerializer(serializers.ModelSerializer):
    patient = patientSerializer()
    class Meta:
        model = patientDocument
        fields = '__all__'

class hospitalDocumentAccess(serializers.ModelSerializer):
    doc = HospitalDocumentSerializer()  
    to = userSerializer()
    class Meta:
        model = HospitalDocumentAcess
        fields = '__all__'

class patientDocumentAccess(serializers.ModelSerializer):
    doc = PatientDocumentSerializer()  # Nesting patientDocument inside patient access
    to = userSerializer()
    class Meta:
        model = PatinetDocumentAcess
        fields = '__all__'
