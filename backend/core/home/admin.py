from django.contrib import admin
from .models import *
# Register your models here.
admin.site.register(hospital)
admin.site.register(doctor)
admin.site.register(patient)
admin.site.register(hospitalLedger)
admin.site.register(hospitalDocument)
admin.site.register(patientDocument)
admin.site.register(documentAcess)
admin.site.register(HospitalDoctors)