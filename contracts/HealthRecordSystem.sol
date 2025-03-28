// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract HealthRecordSystem {

    address public defaultAddress;

    struct HospitalDocument {
        string add;
        address hospital;
        uint256 documentId;
        uint256 patientId;
        uint256 time;    
        bool isPrivate;      
    }

    struct PatientDocument {
        string add;
        uint256 documentId;
        uint256 timestamp;
        uint256 patientId;
        bool isPrivate;
    }

    mapping(uint256 => mapping(address => bool)) hospitalDocumentAuthorizations;
    mapping(uint256 => mapping(address => bool)) patientDocumentAuthorizations;
    mapping(uint256 => HospitalDocument) hospitalDocuments;
    mapping(uint256 => PatientDocument) public patientDocuments;
    event ChangedVisibility(uint256 documentId, bool isPrivate);
    event DocumentAdded(uint256 indexed documentId, string hash, bool isHospital);
    event AccessGranted(uint256 indexed documentId, address indexed user);
    event AccessRevoked(uint256 indexed documentId, address indexed user);
    event AddedHospital(uint indexed hospitalId, address indexed hospitalAddress);
    constructor() {
        defaultAddress = msg.sender;

    }

    modifier onlyOwner() {
        require(msg.sender == defaultAddress, "Not authorized");
        _;
    }
    

    function own() public view returns (address) {
        return defaultAddress;
    }
    function giveHospitalDocumentAccess(uint _id, address _user) public {
        hospitalDocumentAuthorizations[_id][_user] = true;
        emit AccessGranted(_id, _user);
    }
    function givePatientDocumentAccess( uint _id, address _user) public onlyOwner {
        patientDocumentAuthorizations[_id][_user] = true;
        emit AccessGranted(_id, _user);
    }
    function revokePatientDocumentAccess( uint _id, address _user) public onlyOwner {
        patientDocumentAuthorizations[_id][_user] = false;
        emit AccessRevoked(_id, _user);
    }
    function revokeHospitalDocumentAccess(uint _id, address _user) public {
        hospitalDocumentAuthorizations[_id][_user] = false;
        emit AccessRevoked(_id, _user);
    }
    function addHospitalDocument(uint _patid,string  memory _hash,uint256 _documentId,uint256 _timestamp,bool vis) external {
        hospitalDocuments[_documentId] = HospitalDocument(_hash,msg.sender,_documentId,_patid,_timestamp,vis);
        emit DocumentAdded(_documentId, _hash, true);
    }
    function addPatientDocument(uint _patid,uint _docid, string memory _hash,uint256 _timestamp,bool _isPrivate) onlyOwner external {
        patientDocuments[_docid] = PatientDocument(_hash,_docid,_timestamp,_patid,_isPrivate);
        emit DocumentAdded(_docid, _hash, false);
}
    function getPatientDocument(uint _patid,uint _docid) view onlyOwner external returns(string memory){
        if (patientDocuments[_docid].isPrivate){
            require(patientDocumentAuthorizations[_docid][msg.sender] ||  _patid == patientDocuments[_docid].patientId, "Access denied");
        }
        return patientDocuments[_docid].add;
    }
    function getHospitalDocument(uint _docid) view external returns(string memory){
        if (hospitalDocuments[_docid].isPrivate){
            require(hospitalDocumentAuthorizations[_docid][msg.sender] ||  hospitalDocuments[_docid].hospital == msg.sender || msg.sender==defaultAddress, "Access denied");
        }
        return hospitalDocuments[_docid].add;
    }
    function changeHospitalDocumentsVisibility(uint _docid,bool vis,uint _patid)  external{
        require(_patid == hospitalDocuments[_docid].patientId, "Access denied");
        hospitalDocuments[_docid].isPrivate = vis;
        emit ChangedVisibility(_docid, vis);
    }
    function changePatientDocumentsVisibility(uint _docid,bool vis,uint _patid)  external{
        require(_patid == patientDocuments[_docid].patientId, "Access denied");
        patientDocuments[_docid].isPrivate = vis;
        emit ChangedVisibility(_docid, vis);
    }
}