from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView
from web3 import Web3
import json
import os
from .hash import *
from django.shortcuts import render,redirect
from .models import *
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
import time
from .serialzers import *
from web3 import Web3
from rest_framework.permissions import AllowAny
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator



with open(r'/home/sathwik/ArogyaKhosh/backend/core/home/abi.json', "r") as abi_file:
    contract_abi = json.load(abi_file)

def loginView(request):
    return redirect('login')

class HospitalLogin(APIView):
        authentication_classes = [] 
        permission_classes = [AllowAny]
        def post(self, request):
            data = request.data
            serializer=HospitalLoginSerializer(data=data)
            if not serializer.is_valid():
                return Response({"some error":serializer.errors},status=status.HTTP_400_BAD_REQUEST)
            username = serializer.data['username']
            password = serializer.data['password']
            add = serializer.data['address']
            print(add)
            us = authenticate(username=username,password=password)
            if us is None:
                return  Response({
                    "error" : "Invalid username and password"
                },status=status.HTTP_401_UNAUTHORIZED)
            try:
                d = hospital.objects.get(user=us)
                print(d.address)
            except hospital.DoesNotExist:
                return  Response({
                    "error" : "You are not Hospital register as one"
                },status=status.HTTP_401_UNAUTHORIZED)
            try:
                d = hospital.objects.get(user=us,address=add)
            except hospital.DoesNotExist:
                return  Response({
                    "error" : "Incorrect metamask address"
                },status=status.HTTP_401_UNAUTHORIZED)
            token,_ = Token.objects.get_or_create(user=us)
            return Response({
                "token" : token.key,
                "hospId" : d.id,
            },status=status.HTTP_200_OK)
        
@method_decorator(csrf_exempt, name='dispatch')
class DoctorLogin(APIView):
        authentication_classes = [] 
        permission_classes = [AllowAny]
        def post(self, request):
            
            data = request.data
            serializer=HospitalLoginSerializer(data=data)
            if not serializer.is_valid():
                return Response({"some error":serializer.errors},status=status.HTTP_400_BAD_REQUEST)
            username = serializer.data['username']
            password = serializer.data['password']
            add = serializer.data['address']
            us = authenticate(username=username,password=password)
            if us is None:
                return  Response({
                    "error" : "Invalid username and password"
                },status=status.HTTP_401_UNAUTHORIZED)
            d = doctor.objects.filter(user=us).first()
            if d is None:
                return  Response({
                    "error" : "You are not Doctor register as one"
                },status=status.HTTP_401_UNAUTHORIZED)
            d = doctor.objects.filter(user=us,address=add).first()
            if d is None:
                return  Response({
                    "error" : "Incorrect metamask address"
                },status=status.HTTP_401_UNAUTHORIZED)
            token,_ = Token.objects.get_or_create(user=us)
            return Response({
                "token" : token.key,
                "docId" : d.id
            },status=status.HTTP_200_OK)
class PatientLogin(APIView):
        authentication_classes = []
        permission_classes = [AllowAny]
        def post(self, request):
            data = request.data
            serializer=PatientLoginSerializer(data=data)
            if not serializer.is_valid():
                return Response({"some error":serializer.errors},status=status.HTTP_400_BAD_REQUEST)
            username = serializer.data['username']
            password = serializer.data['password']
            us = authenticate(username=username,password=password)
            if us is None:
                return  Response({
                    "error" : "Invalid username and password"
                },status=status.HTTP_401_UNAUTHORIZED)
            d = patient.objects.filter(user=us).first()
            if d is None:
                return  Response({
                    "error" : "You are not a user register as one"
                },status=status.HTTP_401_UNAUTHORIZED)
            token,_ = Token.objects.get_or_create(user=us)
            return Response({
                "token" : token.key,
                "patId" : d.id,
            },status=status.HTTP_200_OK)    
class GetDoctors(APIView):
    def get(self, request,id):
        try:
            user_hospital = hospital.objects.get(id=id)
        except hospital.DoesNotExist:
            return Response({"error": "Hospital does not exsist"}, status=status.HTTP_404_NOT_FOUND)
        hospital_doctors = HospitalDoctors.objects.filter(hospital=user_hospital)
        doctor_ids = hospital_doctors.values_list('doctor_id', flat=True)
        doctors = doctor.objects.filter(id__in=doctor_ids)
        doctor_serializer = DoctorSerializer(doctors, many=True)
        return Response({"doctors": doctor_serializer.data}, status=status.HTTP_200_OK)
class HospitalDashboard(APIView):
    def get(self, request, id):
        try:
            user_hospital = hospital.objects.get(id=id)
        except hospital.DoesNotExist:
            return Response({"error": "Hospital does not exsist"}, status=status.HTTP_404_NOT_FOUND)
        hosp_serializer = HospitalSerializer(user_hospital)
        print(hosp_serializer.data)
        return Response({"hospital": hosp_serializer.data}, status=status.HTTP_200_OK)
class PatientDashboard(APIView):
    def get(self, request,id):
        try:
            pat = patient.objects.get(id=id)
        except patient.DoesNotExist:
            return Response({"error": "patient does nott exist."}, status=status.HTTP_404_NOT_FOUND)
        pat_serializer = PatientSerializer(pat)
        return Response({"patient": pat_serializer.data}, status=status.HTTP_200_OK)
class DoctorDashboard(APIView):
    def get(self, request,id):
        try:
            doc = doctor.objects.get(id=id)
        except doctor.DoesNotExist:
            return Response({"error": "Doctor does not exist."}, status=status.HTTP_404_NOT_FOUND)
        doc_serializer = DoctorSerializer(doc)
        return Response({"doctor": doc_serializer.data}, status=status.HTTP_200_OK)
class PatientDoc(APIView):
    def get(self,request,id):
        try: 
            pat = patient.objects.get(id=id)
        except patient.DoesNotExist:
            return Response({"error": "Patient does not exist."}, status=status.HTTP_404_NOT_FOUND)
        patd = patientDocument.objects.filter(patient=pat)
        patd_serializer = PatientPersonalDocumentSerializer(patd,many=True)
        try: 
            hospd = hospitalLedger.objects.filter(patient=pat)
        except hospitalLedger.DoesNotExist:
            return Response({"error": "No hospital document found for this patient."}, status=status.HTTP_404_NOT_FOUND)
        hosp_d = hospitalDocument.objects.filter(hospitalLedger__in = hospd)
        hosp_d_serializer = PatientHospitalDocumentSerializer(hosp_d, many=True)
        context = {
            "patient": patd_serializer.data,
            "hospital": hosp_d_serializer.data,
            
        }
        return Response(context, status=status.HTTP_200_OK)
class getPatientDocStatus(APIView):
    def get(self, request, id):
        try:
            patd = patientDocument.objects.get(id=id)
        except patientDocument.DoesNotExist:
            return Response({"error": "Patient document does not exist."}, status=status.HTTP_404_NOT_FOUND)
        if PatinetDocumentAcess.objects.filter(doc=patd,to=request.user,sanctioned=True).exists():
            return Response(status=status.HTTP_200_OK)
        if patd.isPrivate == False:
            return Response(status=status.HTTP_200_OK)
        try:
            tok = request.COOKIES.get('authToken')
        except KeyError:
            return Response({"error": "Authentication token not found"}, status=status.HTTP_403_FORBIDDEN)
        try:
            token = Token.objects.get(key=tok)
        except Token.DoesNotExist:
            return Response({"error": "Invalid authentication token"}, status=status.HTTP_403_FORBIDDEN)
        if token.user!= patd.patient.user:
            return Response({"error": "Unauthorized access"}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(status=status.HTTP_200_OK)
    
class getHospitalDocStatus(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self,request, id):
        try:
            patd = hospitalDocument.objects.get(id=id)
        except hospitalDocument.DoesNotExist:
            return Response({"error": "Hospital document does not exist."}, status=status.HTTP_404_NOT_FOUND)
        if HospitalDocumentAcess.objects.filter(doc=patd,to=request.user,sanctioned=True).exists():
            return Response(status=status.HTTP_200_OK)
        if patd.isPrivate == False:
            return Response(status=status.HTTP_200_OK)
        if patd.hospitalLedger.hospital.user == request.user:
            return Response(status=status.HTTP_200_OK)
        if patd.hospitalLedger.patient.user == request.user:
            return Response(status=status.HTTP_200_OK)
        return Response({"error": "Unauthorized access"}, status=status.HTTP_401_UNAUTHORIZED)
class checkPatient(APIView):
    def get(self, request, id):
        try:
            tok = request.COOKIES.get('authToken')
        except KeyError:
            return Response({"error": "Authentication token not found"}, status=status.HTTP_403_FORBIDDEN)
        try:
            token = Token.objects.get(key=tok)
        except Token.DoesNotExist:
            return Response({"error": "Invalid authentication token"}, status=status.HTTP_403_FORBIDDEN)
        try:
            patd = patient.objects.get(id=id)
        except patient.DoesNotExist:
            return Response({"error": "Patient does not exist."}, status=status.HTTP_404_NOT_FOUND)
        if token.user!= patd.user:
            return Response({"error": "Unauthorized access"}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(status=status.HTTP_200_OK)
class checkHospital(APIView):
    def get(self, request, id):
        try:
            tok = request.COOKIES.get('authToken')
        except KeyError:
            return Response({"error": "Authentication token not found"}, status=status.HTTP_403_FORBIDDEN)
        try:
            token = Token.objects.get(key=tok)
        except Token.DoesNotExist:
            return Response({"error": "Invalid authentication token"}, status=status.HTTP_403_FORBIDDEN)
        try:
            patd = hospital.objects.get(id=id)
        except hospital.DoesNotExist:
            return Response({"error": "hospital does not exist."}, status=status.HTTP_404_NOT_FOUND)
        if token.user!= patd.user:
            return Response({"error": "Unauthorized access"}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(status=status.HTTP_200_OK)

class HospitalRoleCheckAPIView(APIView):

    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]    
    def get(self, request):
        try:
            user_hospital = hospital.objects.get(user=request.user)
            return Response({'hospital' : user_hospital.name},status=status.HTTP_200_OK)
        except hospital.DoesNotExist:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

class HospitalLedgerAPIView(APIView):

    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Check if user is a hospital
        try:
            user_hospital = hospital.objects.get(user=request.user)
        except hospital.DoesNotExist:
            return Response({
                'detail': 'Only hospitals can register patients'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Prepare data for serializer
        data = request.data.copy()
        data['hospital'] = user_hospital.id
        
        # Validate that the patient and doctor exist
        try:
            patient_obj = patient.objects.get(id=data.get('patient'))
            doctor_obj = doctor.objects.get(id=data.get('doctor'))
        except (patient.DoesNotExist, doctor.DoesNotExist):
            return Response({
                'detail': 'Invalid patient or doctor'
            }, status=status.HTTP_400_BAD_REQUEST)
        serializer = HospitalLedgerSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    



class hospitalPatients(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            user_hospital = hospital.objects.get(user=request.user)
        except hospital.DoesNotExist:
            return Response({
                'detail': 'Only hospitals can view patients'
            }, status=status.HTTP_403_FORBIDDEN)
            
        patients = hospitalLedger.objects.filter(hospital=user_hospital)
        serializer = HospitalLedgerWithNestedSerializer(patients, many=True)
        
        return Response({
            'patients': serializer.data
        })

class hospitalDocumetsView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    def get(self,request,id):
        try:
            user_hospital = hospital.objects.get(user=request.user)
        except hospital.DoesNotExist:
            return Response({
                'detail': 'Only hospitals can view documents'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            pat = hospitalLedger.objects.get(id=id)
        except hospitalLedger.DoesNotExist:
            return Response({
                'detail': 'Ledger  does not exist'
            }, status=status.HTTP_404_NOT_FOUND)
        try:
            documents = hospitalDocument.objects.filter(hospitalLedger=pat)
        except hospitalDocument.DoesNotExist:
            return Response({
                'detail': 'No documents found'
            }, status=status.HTTP_404_NOT_FOUND)
        if pat.hospital != user_hospital:
            return Response({
                'detail': 'Unauthorized access'
            }, status=status.HTTP_403_FORBIDDEN)
        serializer = HospitalDocumentSerializer(documents, many=True)
        
        return Response({
            'documents': serializer.data
        })

import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings

class UploadToIPFS(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        print("Starting upload process...")
        try:
            pat = patient.objects.get(user=request.user)
            print(f"Patient found: ID {pat.id}")
        except patient.DoesNotExist:
            print("ERROR: User is not a patient")
            return Response({
                'detail': 'Only patients can upload documents'
            }, status=status.HTTP_403_FORBIDDEN)
        
        if 'file' not in request.FILES or 'name' not in request.data:
            print("ERROR: Missing file or name in request")
            return Response({"error": "File and name are required"}, status=400)

        file = request.FILES["file"]
        name = request.data["name"]
        print(f"Processing file: {name}, size: {file.size} bytes")

        # Upload to IPFS
        try:
            print("Starting IPFS upload...")
            pinata_url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
            headers = {
                "pinata_api_key": settings.PINATA_API_KEY,
                "pinata_secret_api_key": settings.PINATA_SECRET_KEY,
            }
            files = {"file": (name, file.read())}

            print(f"Sending request to Pinata with API key: {settings.PINATA_API_KEY[:5]}...")
            response = requests.post(pinata_url, headers=headers, files=files)
            print(f"Pinata response status: {response.status_code}")

            if response.status_code != 200:
                print(f"ERROR: IPFS upload failed with response: {response.text}")
                return Response({"error": f"Failed to upload to IPFS: {response.text}"}, status=500)
                
            ipfs_data = response.json()
            cid = ipfs_data["IpfsHash"]
            print(f"Successfully uploaded to IPFS, got CID: {cid}")
            hashcid = encrypt_url(cid)
            print(f"Hashed url {hashcid}")
        except Exception as e:
            print(f"ERROR during IPFS upload: {str(e)}")
            return Response({"error": f"IPFS upload error: {str(e)}"}, status=500)


        try:
            print("Starting blockchain transaction...")

            import os
            from eth_account import Account
            from eth_account.signers.local import LocalAccount
            from web3.exceptions import ContractLogicError


            SEPOLIA_NODE_URL = settings.SEPOLIA_NODE_URL 
            CONTRACT_ADDRESS = settings.CONTRACT_ADDRESS
            PRIVATE_KEY = settings.ETHEREUM_PRIVATE_KEY  
            
            print(f"Connecting to Sepolia at {SEPOLIA_NODE_URL}")
            print(f"Using contract address: {CONTRACT_ADDRESS}")
            print(f"Using private key (first 4 chars): {PRIVATE_KEY[:4]}...")
            web3 = Web3(Web3.HTTPProvider(SEPOLIA_NODE_URL))

            if not web3.is_connected():
                print("ERROR: Cannot connect to Ethereum node")
                return Response({"error": "Cannot connect to Ethereum node"}, status=500)
            print("Successfully connected to Ethereum node")
            

            account: LocalAccount = Account.from_key(PRIVATE_KEY)
            sender_address = account.address
            print(f"Using sender address: {sender_address}")
            

            try:
                contract_address = Web3.to_checksum_address(CONTRACT_ADDRESS)
                print(f"Contract address verified: {contract_address}")
            except ValueError:
                print(f"ERROR: Invalid contract address format: {CONTRACT_ADDRESS}")
                return Response({"error": f"Invalid contract address format: {CONTRACT_ADDRESS}"}, status=400)
                

            try:
                print("Creating contract instance...")
                print(f"ABI length: {len(str(contract_abi))} chars")
                contract = web3.eth.contract(address=contract_address, abi=contract_abi)
                print("Contract instance created successfully")
            except Exception as e:
                print(f"ERROR creating contract instance: {str(e)}")
                return Response({"error": f"Contract initialization error: {str(e)}"}, status=500)
            

            balance = web3.eth.get_balance(sender_address)
            print(f"Sender balance: {balance} wei ({web3.from_wei(balance, 'ether')} ETH)")
            if balance == 0:
                print("ERROR: Sender account has no balance")
                return Response({"error": "Sender account has no balance"}, status=400)
            

            try:
                owner = contract.functions.own().call()  
                print(f"Contract owner: {owner}")
                print(f"Sender address: {sender_address}")
                if owner.lower() != sender_address.lower():
                    print(f"ERROR: Sender {sender_address} is not the contract owner {owner}")
                    return Response({"error": "Sender is not the contract owner"}, status=403)
                print("Sender is the contract owner - OK")
            except (ContractLogicError, AttributeError) as e:
                print(f"ERROR checking contract ownership: {str(e)}")
                return Response({"error": f"Error checking contract ownership: {str(e)}"}, status=500)
            

            try:
                current_timestamp = int(web3.eth.get_block('latest').timestamp)
                print(f"Current blockchain timestamp: {current_timestamp}")
            except Exception as e:
                print(f"ERROR getting blockchain timestamp: {str(e)}")
                return Response({"error": f"Error getting blockchain timestamp: {str(e)}"}, status=500)
            

            try:
                print(f"Creating database record for document: {name}, patient: {pat.id}, hash: {hashcid}")
                patd = patientDocument.objects.create(
                    name=name,
                    patient=pat,
                    hash=cid,
                )
                patd.save()
                print(f"Created patient document in DB with ID: {patd.id}")
            except Exception as e:
                print(f"ERROR creating database record: {str(e)}")
                return Response({"error": f"Database error: {str(e)}"}, status=500)
            

            try:
                nonce = web3.eth.get_transaction_count(sender_address)
                print(f"Current nonce for {sender_address}: {nonce}")
            except Exception as e:
                print(f"ERROR getting nonce: {str(e)}")
                return Response({"error": f"Error getting nonce: {str(e)}"}, status=500)
            
            try:
                gas_price = web3.eth.gas_price
                print(f"Current gas price: {gas_price} wei")
            except Exception as e:
                print(f"ERROR getting gas price: {str(e)}")
                return Response({"error": f"Error getting gas price: {str(e)}"}, status=500)
                
 
            try:
                print(f"Building transaction with params: patient_id={pat.id}, doc_id={patd.id}, cid={hashcid}, timestamp={current_timestamp}")
                

                estimated_gas = contract.functions.addPatientDocument(
                    pat.id, patd.id, str(hashcid), current_timestamp, False
                ).estimate_gas({
                    'from': sender_address,
                })
                

                gas_limit = int(estimated_gas * 1.2)
                print(f"Estimated gas: {estimated_gas}, Using gas limit: {gas_limit}")
                

                transaction = contract.functions.addPatientDocument(
                    pat.id, patd.id, str(hashcid), current_timestamp, False
                ).build_transaction({
                    'from': sender_address,
                    'nonce': nonce,
                    'gas': gas_limit,  
                    'gasPrice': gas_price,
                    'chainId': 11155111  
                })
                print(f"Transaction built successfully")
            except Exception as e:
                print(f"ERROR building transaction: {str(e)}")
                patd.delete()
                return Response({"error": f"Error building transaction: {str(e)}"}, status=500)
            
            try:
                print("Signing transaction...")
                signed_txn = account.sign_transaction(transaction)
                print("Transaction signed successfully")
            except Exception as e:
                print(f"ERROR signing transaction: {str(e)}")
                patd.delete()
                return Response({"error": f"Error signing transaction: {str(e)}"}, status=500)
            
            try:
                print("Sending raw transaction...")
                tx_hash = web3.eth.send_raw_transaction(signed_txn.raw_transaction)
                print(f"Transaction sent with hash: {tx_hash.hex()}")
            except Exception as e:
                print(f"ERROR sending transaction: {str(e)}")
                patd.delete()
                return Response({"error": f"Error sending transaction: {str(e)}"}, status=500)
            
            try:
                print(f"Waiting for transaction receipt...")
                receipt = web3.eth.wait_for_transaction_receipt(tx_hash)
                print(f"Transaction receipt received: status={receipt.status}, gasUsed={receipt.gasUsed}")
                print(f"Full receipt: {receipt}")
            except Exception as e:
                print(f"ERROR waiting for receipt: {str(e)}")
                patd.delete()
                return Response({"error": f"Error waiting for transaction receipt: {str(e)}"}, status=500)
            
            print("Checking for events...")
            event_signature = web3.keccak(text="DocumentAdded(uint256,string,bool)").hex()
            print(f"Looking for event with signature: {event_signature}")
            for log in receipt.logs:
                print(f"Log found: {log}")
                if hasattr(log, 'topics') and log.topics and len(log.topics) > 0:
                    print(f"Topic[0]: {log.topics[0].hex()}")
                    if log.topics[0].hex() == event_signature:
                        print("DocumentAdded event found:", log)
            
            if not receipt.status:
                print("ERROR: Transaction failed according to receipt status")
                patd.delete()
                return Response({"error": "Transaction failed"}, status=500)
            
            print("SUCCESS: Transaction completed successfully")
            return Response({
                "message": "File uploaded to IPFS and stored on Blockchain",
                "cid": cid,
                "url": f"https://gateway.pinata.cloud/ipfs/{cid}",
                "transaction": receipt.transaction_hash.hex() if hasattr(receipt, 'transaction_hash') else receipt['transactionHash'].hex()
            })
            
        except Exception as e:
            print(f"CRITICAL ERROR in blockchain process: {str(e)}")
            print(f"Exception type: {type(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": f"Blockchain error: {str(e)}"}, status=500)

class PatientDocumentVisibiltyStatus(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]
    def get(self,request,id):
        try:
            pat = patientDocument.objects.get(id=id)
        except patientDocument.DoesNotExist:
            return Response(status=404)
        if request.user == pat.patient.user:
            return Response({
                'visible': True
            }, status=200)
        return Response(status=status.HTTP_401_UNAUTHORIZED)
class PatientDocumentView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]
    def get(self, request, patient_id, doc_id):
        print(f"User: {request.user.username}, Patient ID: {patient_id}, Doc ID: {doc_id}")
        
        try:
            doc = patientDocument.objects.get(id=doc_id)
            print(f"Document found: {doc.id}, Patient: {doc.patient.id}")
            
            if doc.isPrivate:
                if doc.patient.user != request.user and not PatinetDocumentAcess.objects.filter(doc=doc,to=request.user,sanctioned=True).exists():     
                    print(f"Document patient mismatch: {doc.patient.id} != {patient_id}")
                    return Response({
                        'detail': 'Document does not belong to this patient'
                    }, status=status.HTTP_403_FORBIDDEN)
            
            import os
            from eth_account import Account
            from eth_account.signers.local import LocalAccount
            from web3.exceptions import ContractLogicError
            
            SEPOLIA_NODE_URL = settings.SEPOLIA_NODE_URL
            CONTRACT_ADDRESS = settings.CONTRACT_ADDRESS
            PRIVATE_KEY = settings.ETHEREUM_PRIVATE_KEY
            
            # Connect to Sepolia
            web3 = Web3(Web3.HTTPProvider(SEPOLIA_NODE_URL))
            
            if not web3.is_connected():
                print("Failed to connect to Ethereum node")
                return Response({"error": "Cannot connect to Ethereum node"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            account: LocalAccount = Account.from_key(PRIVATE_KEY)
            sender_address = account.address
            
            try:
                contract_address = Web3.to_checksum_address(CONTRACT_ADDRESS)
            except ValueError:
                return Response({"error": f"Invalid contract address format: {CONTRACT_ADDRESS}"}, status=400)
            
            contract = web3.eth.contract(address=contract_address, abi=contract_abi)
            print(f"Connected to contract at {contract_address}")
            
            try:
                document_cid = contract.functions.getPatientDocument(
                    int(patient_id),
                    int(doc_id)
                ).call({'from': sender_address})
                print(f"Contract returned CID: {document_cid}")
            except Exception as contract_error:
                print(f"Contract call failed: {str(contract_error)}")
                return Response({"error": f"Blockchain contract error: {str(contract_error)}"}, 
                               status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            if not document_cid:
                print("Empty CID returned from contract")
                return Response({
                    "error": "Document not found or access denied"
                }, status=status.HTTP_404_NOT_FOUND)
            dc=decrypt_url(document_cid)
            ipfs_url = f"https://gateway.pinata.cloud/ipfs/{dc}"
            print(f"Returning IPFS URL: {ipfs_url}")
            
            # Return the URL in the response
            return Response({
                "url": ipfs_url,
                "name": doc.name,
                "cid": document_cid
            }, status=status.HTTP_200_OK)
                
        except patientDocument.DoesNotExist:
            print(f"Document with ID {doc_id} not found in database")
            return Response({
                'detail': 'Document does not exist'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback
            print("Exception in view:")
            traceback.print_exc()
            return Response({
                "error": f"Failed to retrieve document: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
