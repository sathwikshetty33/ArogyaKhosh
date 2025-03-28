from django.db import models
from home.models import *

class hospitallogs(models.Model):
    document_no = models.ForeignKey(hospitalDocument, on_delete=models.CASCADE)
    ipofAccess = models.CharField(max_length=100)
    time = models.DateTimeField(auto_now_add=True)
    hash = models.CharField(max_length=100,blank=True,null=True)
    def __str__(self):
        return f"{self.document_no.name}-{self.ipofAccess}"

class patientlogs(models.Model):
    document_no = models.ForeignKey(patientDocument, on_delete=models.CASCADE)
    ipofAccess = models.CharField(max_length=100)
    time = models.DateTimeField(auto_now_add=True)
    hash = models.CharField(max_length=100,blank=True,null=True)
    def __str__(self):
        return f"{self.document_no.name}-{self.ipofAccess}"