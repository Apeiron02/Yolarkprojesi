# Generated by Django 5.1.2 on 2024-11-05 18:31

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('harita', '0006_alter_restaurant_latitude_alter_restaurant_longitude'),
    ]

    operations = [
        migrations.AddField(
            model_name='chargingstation',
            name='place_id',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]
