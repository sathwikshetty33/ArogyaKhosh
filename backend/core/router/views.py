from django.shortcuts import render

# Create your views here.
def loginView(request):
    return render(request, 'router/login.html')
def doctorDashboard(request, id):
    return render(request, 'router/doctorDashboard.html',{'id' : id})
def hospitalDashboard(request, id):
    return render(request, 'router/hospitalDashboard.html',{'id' : id})
def patientDashboard(request, id):
    return render(request, 'router/patientDashboard.html',{'id' : id})
def addPatient(request):
    return render(request, 'router/patientRegistration.html')
def hospitalPatients(request):
    return render(request, 'router/patients.html')
def hospitalDocumetsView(request, id):
    return render(request, 'router/hospitalDocuments.html',{'id' : id})
def patientUpload(request):
    return render(request, 'router/patientUpload.html')
def chat_page(request):
    return render(request, 'router/aa.html')
def accessPage(request):
    return render(request,'router/viewDocument.html' )