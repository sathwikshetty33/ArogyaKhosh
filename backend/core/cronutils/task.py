from celery import shared_task
from celery.schedules import crontab
from django.db.models import Count, F, Q
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from datetime import timedelta
from collections import Counter
import logging

from home.models import accident, death, hospital, patient
logger = logging.getLogger(__name__)

@shared_task
def detect_suspicious_accident_patterns():
    """
    This task analyzes accident records for suspicious patterns:
    1. Multiple accidents for the same patient within a short time period
    2. Unusual concentration of accidents in certain hospitals (>50% threshold)
    3. Hospitals with abnormal death rates compared to accidents
    4. Patterns with the same police officer reporting multiple accidents
    5. Unusual insurance claim patterns
    """
    logger.info("Starting suspicious accident pattern detection task")
    today = timezone.now()
    one_month_ago = today - timedelta(days=30)
    logger.info(f"Analyzing data from {one_month_ago} to {today}")
    
    suspicious_patterns = {
        'repeat_patients': [],
        'hospital_clusters': [],
        'high_concentration_hospitals': [],  
        'high_death_rates': [],
        'police_patterns': [],
        'high_concentration_police': []  
    }
    

    total_accidents = accident.objects.filter(created_at__gte=one_month_ago).count()
    logger.info(f"Total accidents in period: {total_accidents}")
    
    
    logger.info("Checking for patients with multiple accidents")
    patient_accident_count = {}
    recent_accidents = accident.objects.filter(created_at__gte=one_month_ago)
    logger.info(f"Found {recent_accidents.count()} recent accidents")
    
    for acc in recent_accidents:
        user_id = acc.user.id
        if user_id in patient_accident_count:
            patient_accident_count[user_id].append(acc)
        else:
            patient_accident_count[user_id] = [acc]
    
    logger.info(f"Found {len(patient_accident_count)} unique patients with accidents")
    
    for user_id, accidents in patient_accident_count.items():
        if len(accidents) >= 2:  
            try:
                patient_name = accidents[0].user.name
            except AttributeError:
                patient_name = f"Patient ID: {user_id}"
                
            logger.info(f"Found suspicious pattern: Patient {patient_name} with {len(accidents)} accidents")
            suspicious_patterns['repeat_patients'].append({
                'patient': patient_name,
                'patient_id': user_id,
                'accident_count': len(accidents),
                'dates': [acc.created_at for acc in accidents],
                'accidents': accidents
            })
    
    
    logger.info("Checking for unusual concentration of accidents in hospitals")
    hospital_accidents = accident.objects.filter(
        created_at__gte=one_month_ago,
        hosptial__isnull=False 
    ).values('hosptial').annotate(count=Count('id'))
    
    logger.info(f"Found accidents in {len(hospital_accidents)} different hospitals")
    
    avg_accidents_per_hospital = 0
    if hospital_accidents and total_accidents > 0:
        avg_accidents_per_hospital = sum(h['count'] for h in hospital_accidents) / len(hospital_accidents)
        logger.info(f"Average accidents per hospital: {avg_accidents_per_hospital:.2f}")
    
    for h in hospital_accidents:
        hospital_accident_percentage = (h['count'] / total_accidents) * 100 if total_accidents > 0 else 0
        
        try:
            hospital_obj = hospital.objects.get(id=h['hosptial'])
            hospital_name = hospital_obj.name
            
          
            hospital_accident_records = accident.objects.filter(
                created_at__gte=one_month_ago,
                hosptial_id=h['hosptial']
            )
            

            if h['count'] > (avg_accidents_per_hospital * 1.5):
                logger.info(f"Found hospital with unusual accident frequency: {hospital_name} with {h['count']} accidents")
                suspicious_patterns['hospital_clusters'].append({
                    'hospital': hospital_name,
                    'hospital_id': h['hosptial'],
                    'accident_count': h['count'],
                    'percentage': hospital_accident_percentage,
                    'avg_accident_count': avg_accidents_per_hospital,
                    'accidents': list(hospital_accident_records)
                })
            
        
            if hospital_accident_percentage >= 50:
                logger.warning(f"HIGH CONCENTRATION: Hospital {hospital_name} has {hospital_accident_percentage:.1f}% of all accidents")
                suspicious_patterns['high_concentration_hospitals'].append({
                    'hospital': hospital_name,
                    'hospital_id': h['hosptial'],
                    'accident_count': h['count'],
                    'percentage': hospital_accident_percentage,
                    'total_accidents': total_accidents,
                    'accidents': list(hospital_accident_records)
                })
                
        except hospital.DoesNotExist:
            logger.error(f"Hospital with ID {h['hosptial']} not found")

    logger.info("Checking for hospitals with abnormal death rates")
    for h in hospital_accidents:
        hospital_id = h['hosptial']
        accident_count = h['count']
        
        death_count = death.objects.filter(
            created_at__gte=one_month_ago,
            hosptial_id=hospital_id  
        ).count()
        
        logger.info(f"Hospital ID {hospital_id}: {death_count} deaths out of {accident_count} accidents")
        
        if accident_count > 0:
            death_rate = death_count / accident_count
            if death_rate > 0.25:  
                try:
                    hospital_obj = hospital.objects.get(id=hospital_id)
                    hospital_name = hospital_obj.name
                    logger.warning(f"High death rate detected: {hospital_name} with {death_rate:.1%} death rate")
                    
                # Get the actual death records for this hospital
                    hospital_death_records = death.objects.filter(
                        created_at__gte=one_month_ago,
                        hosptial_id=hospital_id
                    )
                    
                    suspicious_patterns['high_death_rates'].append({
                        'hospital': hospital_name,
                        'hospital_id': hospital_id,
                        'death_rate': death_rate,
                        'accident_count': accident_count,
                        'death_count': death_count,
                        'deaths': list(hospital_death_records)
                    })
                except hospital.DoesNotExist:
                    logger.error(f"Hospital with ID {hospital_id} not found")
    
    logger.info("Checking for patterns with the same police officer")
    police_reports = accident.objects.filter(
        created_at__gte=one_month_ago,
        police__isnull=False
    ).exclude(police='').values_list('police', flat=True)
    
    total_police_reports = len(police_reports)
    logger.info(f"Found {total_police_reports} accident reports with police officers")
    
    police_counter = Counter(police_reports)
    logger.info(f"Found {len(police_counter)} unique police officers reporting accidents")
    
    avg_reports_per_officer = 0
    if police_counter:
        avg_reports_per_officer = sum(police_counter.values()) / len(police_counter)
        logger.info(f"Average reports per officer: {avg_reports_per_officer:.2f}")
    
    for officer, count in police_counter.items():
        officer_percentage = (count / total_police_reports) * 100 if total_police_reports > 0 else 0
        
        officer_accident_records = accident.objects.filter(
            created_at__gte=one_month_ago,
            police=officer
        )
        
        if count > (avg_reports_per_officer * 2):
            logger.warning(f"Officer {officer} has unusual number of reports: {count}")
            suspicious_patterns['police_patterns'].append({
                'officer': officer,
                'report_count': count,
                'percentage': officer_percentage,
                'avg_report_count': avg_reports_per_officer,
                'accidents': list(officer_accident_records)
            })
        
        if officer_percentage >= 50:
            logger.warning(f"HIGH CONCENTRATION: Officer {officer} filed {officer_percentage:.1f}% of all police reports")
            suspicious_patterns['high_concentration_police'].append({
                'officer': officer,
                'report_count': count,
                'percentage': officer_percentage,
                'total_reports': total_police_reports,
                'accidents': list(officer_accident_records)
            })

    suspicious_found = any(suspicious_patterns.values())
    logger.info(f"Suspicious patterns found: {suspicious_found}")
    
    if suspicious_found:
        logger.info("Sending suspicious activity report")
        try:
            send_suspicious_activity_report(suspicious_patterns)
            logger.info("Suspicious activity report sent successfully")
        except Exception as e:
            logger.error(f"Error sending suspicious activity report: {str(e)}")
    try:
        send_task_execution_confirmation(today, one_month_ago, suspicious_found)
        logger.info("Task execution confirmation email sent successfully")
    except Exception as e:
        logger.error(f"Error sending task execution confirmation email: {str(e)}")
    
    logger.info("Suspicious accident pattern detection task completed")
    return "Suspicious accident pattern detection completed"

def send_suspicious_activity_report(patterns):
    """Send detailed email report about suspicious patterns"""
    logger.info("Preparing suspicious activity email report")
    subject = "ALERT: Suspicious Accident Patterns Detected"
    
    message = "The system has detected the following suspicious patterns:\n\n"
    
  
    if patterns['repeat_patients']:
        message += "===== PATIENTS WITH MULTIPLE ACCIDENTS =====\n\n"
        for p in patterns['repeat_patients']:
            message += f"- Patient: {p['patient']}\n"
            message += f"  Number of accidents: {p['accident_count']} in 30 days\n"
            message += f"  Accident dates: {', '.join([d.strftime('%Y-%m-%d') for d in p['dates']])}\n"
            
            try:
                patient_obj = patient.objects.get(id=p['patient_id'])
                message += f"  Patient age: {patient_obj.age}\n"
                message += f"  Patient contact: {patient_obj.contact}\n"
                message += f"  Emergency contact: {patient_obj.emergencyContact}\n"
                
                for i, acc in enumerate(p['accidents']):
                    message += f"  Accident #{i+1} details:\n"
                    message += f"    Date: {acc.created_at.strftime('%Y-%m-%d %H:%M')}\n"
                    message += f"    Hospital: {acc.hosptial.name if acc.hosptial else 'Not recorded'}\n"
                    message += f"    Police officer: {acc.police if acc.police else 'Not recorded'}\n"
            except Exception as e:
                logger.error(f"Error fetching detailed patient information: {str(e)}")
                message += f"  (Error retrieving detailed information: {str(e)})\n"
            
            message += "\n"
    
    
    if patterns['hospital_clusters']:
        message += "===== HOSPITALS WITH UNUSUAL ACCIDENT FREQUENCIES =====\n\n"
        for h in patterns['hospital_clusters']:
            message += f"- {h['hospital']}: {h['accident_count']} accidents ({h['percentage']:.1f}% of all accidents)\n"
            message += f"  Average across hospitals: {h['avg_accident_count']:.1f} accidents\n"
            
            try:
                hospital_obj = hospital.objects.get(id=h['hospital_id'])
                message += f"  Hospital address: {hospital_obj.address}\n"
                message += f"  Hospital contact: {hospital_obj.contact}\n"
                message += f"  Hospital license: {hospital_obj.license}\n"
                
               
                reporting_officers = {}
                for acc in h['accidents']:
                    if acc.police and acc.police.strip():
                        if acc.police not in reporting_officers:
                            reporting_officers[acc.police] = 1
                        else:
                            reporting_officers[acc.police] += 1
                
                if reporting_officers:
                    message += f"  Reporting police officers:\n"
                    for officer, count in sorted(reporting_officers.items(), key=lambda x: x[1], reverse=True):
                        percentage = (count / len(h['accidents'])) * 100
                        message += f"    - {officer}: {count} reports ({percentage:.1f}% of hospital's accidents)\n"
                
                message += f"  Recent accidents at this hospital:\n"
                for i, acc in enumerate(sorted(h['accidents'], key=lambda x: x.created_at, reverse=True)[:10]):
                    message += f"    #{i+1}: Patient: {acc.user.name}, "
                    message += f"Date: {acc.created_at.strftime('%Y-%m-%d')}, "
                    message += f"Police officer: {acc.police if acc.police else 'Not recorded'}\n"
                
                if len(h['accidents']) > 10:
                    message += f"    ... and {len(h['accidents']) - 10} more accidents\n"
            except Exception as e:
                logger.error(f"Error fetching detailed hospital information: {str(e)}")
                message += f"  (Error retrieving detailed information: {str(e)})\n"
            
            message += "\n"
    
    
    if patterns['high_concentration_hospitals']:
        message += "===== CRITICAL: HOSPITALS WITH >50% OF ALL ACCIDENTS =====\n\n"
        for h in patterns['high_concentration_hospitals']:
            message += f"- {h['hospital']}: {h['accident_count']} accidents ({h['percentage']:.1f}% of all accidents)\n"
            message += f"  Total accidents in period: {h['total_accidents']}\n"
            
            try:
                hospital_obj = hospital.objects.get(id=h['hospital_id'])
                message += f"  Hospital address: {hospital_obj.address}\n"
                message += f"  Hospital contact: {hospital_obj.contact}\n"
                message += f"  Hospital license: {hospital_obj.license}\n"
                
              
                timeline = {}
                for acc in h['accidents']:
                    date_key = acc.created_at.strftime('%Y-%m-%d')
                    if date_key not in timeline:
                        timeline[date_key] = 1
                    else:
                        timeline[date_key] += 1
                
                message += f"  Accident timeline:\n"
                for date, count in sorted(timeline.items()):
                    message += f"    - {date}: {count} accidents\n"
                
              
                officers = {}
                for acc in h['accidents']:
                    if acc.police and acc.police.strip():
                        if acc.police not in officers:
                            officers[acc.police] = 1
                        else:
                            officers[acc.police] += 1
                
                if officers:
                    message += f"  Reporting police officers:\n"
                    for officer, count in sorted(officers.items(), key=lambda x: x[1], reverse=True):
                        percentage = (count / len(h['accidents'])) * 100
                        message += f"    - {officer}: {count} reports ({percentage:.1f}% of hospital's accidents)\n"
                        
                      
                        if percentage > 50:
                            message += f"      WARNING: Officer {officer} is responsible for majority of this hospital's reports\n"
                
            except Exception as e:
                logger.error(f"Error fetching detailed high concentration hospital information: {str(e)}")
                message += f"  (Error retrieving detailed information: {str(e)})\n"
            
            message += "\n"
    

    if patterns['high_death_rates']:
        message += "===== HOSPITALS WITH HIGH DEATH RATES =====\n\n"
        for h in patterns['high_death_rates']:
            message += f"- {h['hospital']}: {h['death_rate']:.1%} death rate ({h['death_count']} deaths / {h['accident_count']} accidents)\n"
            
            try:
                hospital_obj = hospital.objects.get(id=h['hospital_id'])
                message += f"  Hospital address: {hospital_obj.address}\n"
                message += f"  Hospital contact: {hospital_obj.contact}\n"
                message += f"  Hospital license: {hospital_obj.license}\n"
                
                message += f"  Recent deaths at this hospital:\n"
                for i, d in enumerate(sorted(h['deaths'], key=lambda x: x.created_at, reverse=True)[:10]):
                    message += f"    #{i+1}: Date: {d.created_at.strftime('%Y-%m-%d')}, "
                    message += f"Related accident date: {d.user.created_at.strftime('%Y-%m-%d')}, "
                    message += f"Patient: {d.user.user.name}\n"
                    if hasattr(d.user, 'police') and d.user.police:
                        message += f"        Reporting officer: {d.user.police}\n"
                
                if len(h['deaths']) > 10:
                    message += f"    ... and {len(h['deaths']) - 10} more deaths\n"
            except Exception as e:
                logger.error(f"Error fetching detailed death information: {str(e)}")
                message += f"  (Error retrieving detailed information: {str(e)})\n"
            
            message += "\n"
    

    if patterns['police_patterns']:
        message += "===== POLICE OFFICERS WITH UNUSUAL REPORTING PATTERNS =====\n\n"
        for p in patterns['police_patterns']:
            message += f"- Officer {p['officer']}: {p['report_count']} reports ({p['percentage']:.1f}% of all reports)\n"
            message += f"  Average reports per officer: {p['avg_report_count']:.1f}\n"
            
            try:
              
                hospitals_reported = {}
                for acc in p['accidents']:
                    hospital_id = acc.hosptial.id if acc.hosptial else 'Unknown'
                    hospital_name = acc.hosptial.name if acc.hosptial else 'Unknown'
                    
                    if hospital_id not in hospitals_reported:
                        hospitals_reported[hospital_id] = {
                            'name': hospital_name,
                            'count': 1,
                            'accidents': [acc]
                        }
                    else:
                        hospitals_reported[hospital_id]['count'] += 1
                        hospitals_reported[hospital_id]['accidents'].append(acc)
                
            
                message += f"  Distribution across hospitals:\n"
                for hospital_id, data in sorted(hospitals_reported.items(), key=lambda x: x[1]['count'], reverse=True):
                    percentage = (data['count'] / p['report_count']) * 100
                    message += f"    - {data['name']}: {data['count']} reports ({percentage:.1f}%)\n"
                    
                   
                    if percentage > 70:
                        message += f"      WARNING: {percentage:.1f}% of this officer's reports are from a single hospital\n"
                
         
                message += f"  Timeline of reports:\n"
                timeline = {}
                for acc in p['accidents']:
                    date_key = acc.created_at.strftime('%Y-%m-%d')
                    if date_key not in timeline:
                        timeline[date_key] = 1
                    else:
                        timeline[date_key] += 1
                
                for date, count in sorted(timeline.items()):
                    message += f"    - {date}: {count} reports\n"
                
                    if count > (p['report_count'] / len(timeline)) * 2:
                        message += f"      WARNING: Unusual spike in reports on this date\n"
                
                message += f"  Recent accidents reported by this officer:\n"
                for i, acc in enumerate(sorted(p['accidents'], key=lambda x: x.created_at, reverse=True)[:10]):
                    message += f"    #{i+1}: Date: {acc.created_at.strftime('%Y-%m-%d %H:%M')}, "
                    message += f"Patient: {acc.user.name}, "
                    message += f"Hospital: {acc.hosptial.name if acc.hosptial else 'Not recorded'}\n"
                
                if len(p['accidents']) > 10:
                    message += f"    ... and {len(p['accidents']) - 10} more reports\n"
            except Exception as e:
                logger.error(f"Error fetching detailed officer information: {str(e)}")
                message += f"  (Error retrieving detailed information: {str(e)})\n"
            
            message += "\n"
    

    if patterns['high_concentration_police']:
        message += "===== CRITICAL: POLICE OFFICERS WITH >50% OF ALL REPORTS =====\n\n"
        for p in patterns['high_concentration_police']:
            message += f"- Officer {p['officer']}: {p['report_count']} reports ({p['percentage']:.1f}% of all reports)\n"
            message += f"  Total police reports in period: {p['total_reports']}\n"
            
            try:
              
                hospitals_reported = {}
                for acc in p['accidents']:
                    hospital_id = acc.hosptial.id if acc.hosptial else 'Unknown'
                    hospital_name = acc.hosptial.name if acc.hosptial else 'Unknown'
                    
                    if hospital_id not in hospitals_reported:
                        hospitals_reported[hospital_id] = {
                            'name': hospital_name,
                            'count': 1
                        }
                    else:
                        hospitals_reported[hospital_id]['count'] += 1
                
               
                message += f"  Hospital distribution:\n"
                for hospital_id, data in sorted(hospitals_reported.items(), key=lambda x: x[1]['count'], reverse=True):
                    percentage = (data['count'] / p['report_count']) * 100
                    message += f"    - {data['name']}: {data['count']} reports ({percentage:.1f}% of officer's reports)\n"
                    
                    if percentage > 50:
                        message += f"      CRITICAL: Officer has concentrated relationship with this hospital\n"
                        
                      
                        if hospital_id != 'Unknown':
                            deaths_count = death.objects.filter(
                                created_at__gte=timezone.now() - timedelta(days=30),
                                hosptial_id=hospital_id,
                                user__police=p['officer']
                            ).count()
                            
                            if deaths_count > 0:
                                message += f"      CRITICAL: {deaths_count} deaths associated with this officer at this hospital\n"
                
               
                patients = {}
                for acc in p['accidents']:
                    patient_id = acc.user.id
                    patient_name = acc.user.name
                    
                    if patient_id not in patients:
                        patients[patient_id] = {
                            'name': patient_name,
                            'count': 1
                        }
                    else:
                        patients[patient_id]['count'] += 1
                
                repeat_patients = {pid: data for pid, data in patients.items() if data['count'] > 1}
                if repeat_patients:
                    message += f"  Patients with multiple accidents reported by this officer:\n"
                    for patient_id, data in sorted(repeat_patients.items(), key=lambda x: x[1]['count'], reverse=True):
                        message += f"    - {data['name']}: {data['count']} accidents\n"
            
            except Exception as e:
                logger.error(f"Error fetching detailed high concentration officer information: {str(e)}")
                message += f"  (Error retrieving detailed information: {str(e)})\n"
            
            message += "\n"
    
    message += "\n\n========== RECOMMENDATION ==========\n\n"

    if patterns['high_concentration_hospitals'] or patterns['high_concentration_police']:
        message += "IMMEDIATE ACTION RECOMMENDED:\n"
        
        if patterns['high_concentration_hospitals']:
            message += "1. Conduct audit of hospitals with >50% concentration of accident reports\n"
            
        if patterns['high_concentration_police']:
            message += f"2. Investigate police officers with >50% concentration of accident reports\n"
            
        if any(h['death_rate'] > 0.5 for h in patterns['high_death_rates']):
            message += "3. Urgent investigation needed for hospitals with >50% death rate\n"
    
    message += "\n\n========== DETAILED APPENDIX ==========\n\n"
    message += "Full records are available in the system. This report highlights the most critical patterns.\n"
    message += "Please login to the ArogyaKhosh dashboard for complete details and to take further action.\n"
    
    logger.info(f"Sending email to: {settings.ADMIN_EMAIL}")
    logger.debug(f"Email subject: {subject}")
    logger.debug(f"Email content summary (length: {len(message)} chars)")
    
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [settings.ADMIN_EMAIL],
            fail_silently=False,
        )
        logger.info("Email sent successfully")
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise

def send_task_execution_confirmation(analysis_date, start_date, suspicious_found):
    """Send confirmation email about task execution"""
    logger.info("Preparing task execution confirmation email")
    
    subject = "Suspicious Accident Detection Task: Execution Confirmation"
    
    message = f"""
ArogyaKhosh System Notification

This is to confirm that the suspicious accident pattern detection task ran successfully.

Execution Details:
- Task Name: detect_suspicious_accident_patterns
- Execution Time: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}
- Analysis Period: {start_date.strftime('%Y-%m-%d')} to {analysis_date.strftime('%Y-%m-%d')}
- Suspicious Patterns Found: {'Yes' if suspicious_found else 'No'}

This is an automated message. Please do not reply to this email.
"""

    logger.info(f"Sending confirmation email to: {settings.ADMIN_EMAIL}")

    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [settings.ADMIN_EMAIL],
            fail_silently=False,
        )
        logger.info("Confirmation email sent successfully")
    except Exception as e:
        logger.error(f"Failed to send confirmation email: {str(e)}")
        raise