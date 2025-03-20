from django.urls import path
from . import views
from .views import *
urlpatterns = [
    path('',views.loginView,name='login'),
    path('doctor-dashboard/<int:id>',views.doctorDashboard,name='doctor-dashboard'),
    path('hospital-dashboard/<int:id>',views.hospitalDashboard,name='hospital-dashboard'),
    path('patient-dashboard/<int:id>',views.patientDashboard,name='patient-dashboard'),
    path('add-patient/',views.addPatient,name='add-patient'),
    path('hospital-patients/',views.hospitalPatients,name='hospital-patients'),
    path('hospital-document/<int:id>',views.hospitalDocumetsView,name='hospital-document'),
    path('patient-upload/',views.patientUpload,name='patient-upload'),
    path('chat/', chat_page, name='chat_page'),
    path('access/',views.accessPage, name='access')
]