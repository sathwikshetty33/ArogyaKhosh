from rest_framework import serializers
from .models import *
class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = doctor
        fields = '__all__'
class HospitalLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()
    address = serializers.CharField()
class GetDoctorsSerializer(serializers.Serializer):
    id = serializers.IntegerField()
class HospitalSerializer(serializers.ModelSerializer):
    class Meta:
        model = hospital
        fields = '__all__'
class PatientLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = patient
        fields = '__all__'

class HospitalDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = hospitalDocument
        fields = '__all__'

class PatientPersonalDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = patientDocument
        fields = '__all__'
class PatientHospitalDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = hospitalDocument
        fields = '__all__'
class HospitalLedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model = hospitalLedger
        fields = ['id', 'hospital', 'date', 'reason', 'patient', 'doctor', 'isDischarged']
        read_only_fields = ['date']
class HospitalLedgerWithNestedSerializer(serializers.ModelSerializer):
    patient = PatientSerializer()
    doctor = DoctorSerializer()
    
    class Meta:
        model = hospitalLedger
        fields = ['id', 'patient', 'doctor', 'reason', 'date', 'isDischarged']

class DocumentProcessStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentProcessStatus
        fields = ['id', 'patient_id', 'document_id', 'task_id', 'file_name', 'status']