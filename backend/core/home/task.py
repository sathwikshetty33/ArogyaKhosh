import os
import traceback
from celery import shared_task  # ✅ Correc
from django.conf import settings
from django.db import transaction
from web3 import Web3
from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3.exceptions import ContractLogicError
import requests
from .hash import *
from .models import patient, patientDocument, DocumentProcessStatus

@shared_task(bind=True)
def upload_document_to_ipfs_and_blockchain(self, patient_id, file_name, file_content):
    """
    Async task to upload document to IPFS and blockchain
    
    Args:
        patient_id (int): ID of the patient
        file_name (str): Name of the file
        file_content (bytes): File content
    
    Returns:
        dict: Result of the upload process
    """
    # Create process status entry
    process_status = DocumentProcessStatus.objects.create(
        patient= patient.objects.get(id=patient_id),
        file_name=file_name,
        status='PROCESSING',
        task_id=self.request.id
    )

    try:
        # Fetch patient
        try:
            pat = patient.objects.get(id=patient_id)
        except patient.DoesNotExist:
            process_status.status = 'FAILED'
            process_status.error_message = 'Patient not found'
            process_status.save()
            return {'error': 'Patient not found'}

        # Upload to IPFS
        try:
            pinata_url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
            headers = {
                "pinata_api_key": settings.PINATA_API_KEY,
                "pinata_secret_api_key": settings.PINATA_SECRET_KEY,
            }
            files = {"file": (file_name, file_content)}

            response = requests.post(pinata_url, headers=headers, files=files)

            if response.status_code != 200:
                process_status.status = 'FAILED'
                process_status.error_message = f'IPFS upload failed: {response.text}'
                process_status.save()
                return {'error': f'Failed to upload to IPFS: {response.text}'}
                
            ipfs_data = response.json()
            cid = ipfs_data["IpfsHash"]
            print(f"Recived url: {cid}")
            # Optionally encrypt or hash the CID
            hashcid = encrypt_url(cid)  # Assuming this function exists
            print(f"Encrypted url: {hashcid}")
        except Exception as e:
            process_status.status = 'FAILED'
            process_status.error_message = f'IPFS upload error: {str(e)}'
            process_status.save()
            return {'error': f'IPFS upload error: {str(e)}'}

        # Blockchain transaction
        try:
            # Web3 connection setup
            import json

            web3 = Web3(Web3.HTTPProvider(settings.SEPOLIA_NODE_URL))
            with open(r'/home/sathwik/new/ArogyaKhosh/backend/core/home/abi.json', "r") as abi_file:
                contract_abi = json.load(abi_file)
            # Account setup
            account: LocalAccount = Account.from_key(settings.ETHEREUM_PRIVATE_KEY)
            sender_address = account.address
            
            # Contract setup
            contract_address = Web3.to_checksum_address(settings.CONTRACT_ADDRESS)
            contract = web3.eth.contract(address=contract_address, abi=contract_abi)
            
            # Create patient document
            patd = patientDocument.objects.create(
                name=file_name,
                patient=pat,
                hash=cid,
            )
            
            # Get blockchain details
            current_timestamp = int(web3.eth.get_block('latest').timestamp)
            nonce = web3.eth.get_transaction_count(sender_address)
            gas_price = web3.eth.gas_price
            
            # Estimate and build transaction
            estimated_gas = contract.functions.addPatientDocument(
                pat.id, patd.id, str(hashcid), current_timestamp, False
            ).estimate_gas({'from': sender_address})
            
            gas_limit = int(estimated_gas * 1.2)
            
            transaction = contract.functions.addPatientDocument(
                pat.id, patd.id, str(hashcid), current_timestamp, False
            ).build_transaction({
                'from': sender_address,
                'nonce': nonce,
                'gas': gas_limit,
                'gasPrice': gas_price,
                'chainId': 11155111  # Sepolia chain ID
            })
            
            # Sign and send transaction
            signed_txn = account.sign_transaction(transaction)
            tx_hash = web3.eth.send_raw_transaction(signed_txn.raw_transaction)
            
            # Wait for receipt
            receipt = web3.eth.wait_for_transaction_receipt(tx_hash)
            
            # Update process status
            process_status.status = 'COMPLETED' if receipt.status else 'FAILED'
            process_status.save()
            
            return {
                "message": "File uploaded to IPFS and stored on Blockchain",
                "cid": cid,
                "url": f"https://gateway.pinata.cloud/ipfs/{cid}",
                "transaction": tx_hash.hex()
            }
        
        except Exception as e:
            process_status.status = 'FAILED'
            process_status.error_message = f'Blockchain error: {str(e)}'
            process_status.save()
            return {'error': f'Blockchain error: {str(e)}'}
    
    except Exception as e:
        process_status.status = 'FAILED'
        process_status.error_message = f'Unexpected error: {str(e)}'
        process_status.save()
        return {'error': f'Unexpected error: {str(e)}'}