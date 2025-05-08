from django.contrib import admin
from .models import *
from logs.models import *
# Register your models here.
admin.site.register(hospital)
admin.site.register(doctor)
admin.site.register(patient)
admin.site.register(hospitalLedger)
admin.site.register(hospitalDocument)
admin.site.register(patientDocument)
admin.site.register(HospitalDocumentAcess)
admin.site.register(PatinetDocumentAcess)
admin.site.register(HospitalDoctors)
admin.site.register(hospitallogs)
admin.site.register(patientlogs)
admin.site.register(DocumentProcessStatus)
admin.site.register(accident)