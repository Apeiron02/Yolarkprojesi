# Generated by Django 5.1.2 on 2024-11-01 21:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('araclar', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='araclar',
            name='max_menzil',
            field=models.IntegerField(),
        ),
        migrations.AlterField(
            model_name='araclar',
            name='min_menzil',
            field=models.IntegerField(),
        ),
        migrations.AlterField(
            model_name='araclar',
            name='ortalama_menzil',
            field=models.IntegerField(),
        ),
    ]