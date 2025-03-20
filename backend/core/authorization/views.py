from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView
from web3 import Web3
import json
import os
from django.shortcuts import render,redirect
from home.models import *
from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from web3 import Web3
from django.conf import settings
from django.db.models import Q
import hashlib
from .serializers import *
import time
from web3 import Web3
from rest_framework.permissions import AllowAny
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

class changepatientDocumentView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            doc = request.data['doc']
        except:
            return Response({'status': 'failed', 'message': 'Invalid Request'}, status=status.HTTP_400_BAD_REQUEST)
        doc = get_object_or_404(patientDocument, id=doc)
        if doc.patient.user == request.user:
            doc.isPrivate = not doc.isPrivate
            doc.save()
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        else:
            return Response({'status': 'failed', 'message': 'You are not authorized to access this document'}, status=status.HTTP_401_UNAUTHORIZED)
class changeHospitalDocumentView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            doc = request.data['doc']
        except:
            return Response({'status': 'failed', 'message': 'Invalid Request'}, status=status.HTTP_400_BAD_REQUEST)
        doc = get_object_or_404(hospitalDocument, id=doc)
        if doc.hospitalLedger.patient.user == request.user:
            doc.isPrivate = not doc.isPrivate
            doc.save()
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        else:
            return Response({'status': 'failed', 'message': 'You are not authorized to access this document'}, status=status.HTTP_401_UNAUTHORIZED)
class createPatientAccessreq(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            doc = request.data['doc']
            user = request.user
        except:
            return Response({'status': 'failed', 'message': 'Invalid Request'}, status=status.HTTP_400_BAD_REQUEST)
        if PatinetDocumentAcess.objects.filter(doc=doc,to=user,declined=False):
            return Response({'status': 'failed', 'message': 'You have already requested access to this document'},status=status.HTTP_400_BAD_REQUEST)
        else:
            PatinetDocumentAcess.objects.create(doc=doc,to=user,declined=False)
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
class createHospitalAccessreq(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            doc = request.data['doc']
            user = request.user
        except:
            return Response({'status': 'failed', 'message': 'Invalid Request'}, status=status.HTTP_400_BAD_REQUEST)
        if HospitalDocumentAcess.objects.filter(doc=doc,to=user,declined=False):
            return Response({'status': 'failed', 'message': 'You have already requested access to this document'},status=status.HTTP_400_BAD_REQUEST)
        else:
            HospitalDocumentAcess.objects.create(doc=doc,to=user,declined=False)
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
class changePatientDocumentAccess(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            doc = request.data['doc']
        except:
            return Response({'status': 'failed', 'message': 'Invalid Request'}, status=status.HTTP_400_BAD_REQUEST)
        req = get_object_or_404(PatinetDocumentAcess,id=doc)
        if req.doc.patient.user == request.user:
            req.sanctioned = not req.sanctioned
            req.save()
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        else:
            return Response({'status': 'failed', 'message': 'You are not authorized to access this document'}, status=status.HTTP_401_UNAUTHORIZED)
        
class changeHospitalDocumentAccess(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            doc = request.data['doc']
            user = request.data['user']
        except:
            return Response({'status': 'failed', 'message': 'Invalid Request'}, status=status.HTTP_400_BAD_REQUEST)
        us = get_object_or_404(User, id=user)
        doc = get_object_or_404(hospitalDocument,id=doc)
        req = get_object_or_404(HospitalDocumentAcess,doc=doc,to=us)
        if doc.hospitalLedger.patient.user == request.user:
            req.sanctioned = not req.sanctioned
            doc.save()
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        else:
            return Response({'status': 'failed', 'message': 'You are not authorized to access this document'}, status=status.HTTP_401_UNAUTHORIZED)
        
class declinePatientDocumentReq(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            id = request.data['id']
        except:
            return Response({'status': 'failed', 'message': 'Invalid Request'}, status=status.HTTP_400_BAD_REQUEST)
        req = get_object_or_404(PatinetDocumentAcess,id=id)
        if req.doc.patient.user == request.user:
            req.declined= True
            req.save()
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        else:
            return Response({'status': 'failed', 'message': 'You are not authorized to access this document'}, status=status.HTTP_401_UNAUTHORIZED)
        
class declineHospitalDocumentReq(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            id = request.data['id']
        except:
            return Response({'status': 'failed', 'message': 'Invalid Request'}, status=status.HTTP_400_BAD_REQUEST)
        req = get_object_or_404(HospitalDocumentAcess,id=id)
        if req.doc.hospitalLedger.patient.user == request.user:
            req.declined= True
            req.save()
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        else:
            return Response({'status': 'failed', 'message': 'You are not authorized to access this document'}, status=status.HTTP_401_UNAUTHORIZED)
class PatientDocumentRequestList(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Retrieve the patient object associated with the authenticated user
        patient_obj = get_object_or_404(patient, user=request.user)

        # Retrieve documents where the patient is the owner
        docs = PatinetDocumentAcess.objects.filter(doc__patient=patient_obj)

        # Assuming you have a serializer for PatientDocumentAccess
        serializer = patientDocumentAccess(docs, many=True)
        
        return Response(serializer.data)
class HospitalDocumentRequestList(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Retrieve the patient object associated with the authenticated user
        patient_obj = get_object_or_404(patient, user=request.user)

        # Retrieve documents where the patient is the owner
        docs = HospitalDocumentAcess.objects.filter(doc__hospitalLedger__patient=patient_obj)

        # Assuming you have a serializer for PatientDocumentAccess
        serializer = hospitalDocumentAccess(docs, many=True)
        
        return Response(serializer.data)
       